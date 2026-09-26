const DEFAULT_TIMEOUT_MS = 20000;

const PROVIDERS = [
  {
    name: "groq",
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
    run: callOpenAICompatible.bind(null, {
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    }),
  },
  {
    name: "gemini",
    key: () => process.env.GEMINI_API_KEY,
    model: () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    run: callGemini,
  },
  {
    name: "mistral",
    key: () => process.env.MISTRAL_API_KEY,
    model: () => process.env.MISTRAL_MODEL || "ministral-14b-2512",
    run: callOpenAICompatible.bind(null, {
      provider: "mistral",
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
    }),
  },
];

const coolingDownUntil = new Map();
const COOLDOWN_MS = 60_000;
const GROQ_SAFE_INPUT_CHARS = Number(process.env.GROQ_SAFE_INPUT_CHARS) || 16000;

function timeoutSignal() {
  return AbortSignal.timeout(
    Number(process.env.AI_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  );
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function readError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.message || JSON.stringify(body);
  } catch {
    try { detail = await response.text(); } catch { /* ignore */ }
  }
  const error = new Error(
    `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`
  );
  error.status = response.status;

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) error.retryAfterMs = Math.ceil(seconds * 1000);
  }

  if (!error.retryAfterMs) {
    const match = detail.match(/try again in\s+([0-9.]+)s/i);
    if (match) error.retryAfterMs = Math.ceil(Number(match[1]) * 1000);
  }

  return error;
}

function shouldCoolDown(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").toLowerCase();
  return (
    status === 401 || status === 403 || status === 429 || status >= 500 ||
    message.includes("quota") || message.includes("rate limit") ||
    message.includes("exhaust") || message.includes("overloaded")
  );
}

function dataUrlToParts(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!match) throw new Error("Invalid attachment data URL.");
  return { mimeType: match[1], base64: match[2] };
}

async function callGemini({ apiKey, model, systemPrompt, userText, imageDataUrl, maxTokens, temperature, jsonMode }) {
  const parts = [{ text: userText }];
  if (imageDataUrl) {
    const { mimeType, base64 } = dataUrlToParts(imageDataUrl);
    parts.push({ inlineData: { mimeType, data: base64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: timeoutSignal(),
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!response.ok) throw await readError(response);
  const body = await response.json();
  const text = (body?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

async function callOpenAICompatible(config, { apiKey, model, systemPrompt, userText, imageDataUrl, maxTokens, temperature, jsonMode }) {
  const content = imageDataUrl
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : userText;

  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content },
    ],
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: timeoutSignal(),
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await readError(response);
  const data = await response.json();
  const text = cleanText(data?.choices?.[0]?.message?.content);
  if (!text) throw new Error(`${config.provider} returned an empty response.`);
  return text;
}

export async function generateText({
  systemPrompt = "",
  userText,
  imageDataUrl = null,
  maxTokens = 1200,
  temperature = 0,
  jsonMode = false,
}) {
  const errors = [];

  for (const provider of PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) {
      errors.push(`${provider.name}: key missing`);
      continue;
    }

    if ((coolingDownUntil.get(provider.name) || 0) > Date.now()) {
      errors.push(`${provider.name}: cooling down`);
      continue;
    }

    const model = provider.model();

    // Groq's free/on-demand tier has a small input-token-per-minute budget.
    // Skip an oversized Groq attempt instead of knowingly spending rate-limit
    // capacity on a request that is likely to be rejected. Mistral remains
    // available immediately as the next fallback.
    if (provider.name === "groq") {
      const estimatedChars = String(systemPrompt || "").length + String(userText || "").length;
      if (estimatedChars > GROQ_SAFE_INPUT_CHARS) {
        console.warn(`Verdict AI groq skipped: compact input is still too large (${estimatedChars} chars).`);
        errors.push(`groq: input too large for safe free-tier attempt`);
        continue;
      }
    }

    try {
      const text = await provider.run({
        apiKey,
        model,
        systemPrompt,
        userText,
        imageDataUrl,
        maxTokens,
        temperature,
        jsonMode,
      });
      console.log(`Verdict AI provider: ${provider.name} (${model})`);
      return { text, provider: provider.name, model };
    } catch (error) {
      console.warn(`Verdict AI ${provider.name} failed:`, error?.message || error);
      errors.push(`${provider.name}: ${error?.message || "failed"}`);
      if (shouldCoolDown(error)) {
        const cooldownMs = Math.max(COOLDOWN_MS, Number(error?.retryAfterMs || 0));
        coolingDownUntil.set(provider.name, Date.now() + cooldownMs);
      }
    }
  }

  const error = new Error("All configured Verdict AI providers are unavailable.");
  error.name = "AIProvidersUnavailable";
  error.providerErrors = errors;
  throw error;
}
