import { generateText } from "./ai/provider.js";
import { productKnowledgeText } from "./productKnowledge.js";

function parseJson(text) {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch { /* continue */ }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return null;
}

export async function answerVerdictProductQuestion(question) {
  const q = typeof question === "string" ? question.trim() : "";
  if (!q) return null;

  const systemPrompt = `You are the product-help router for Verdict.

Your job is to decide whether the user's message is asking HOW VERDICT ITSELF WORKS, where something is in Verdict, how to use a Verdict feature, what a Verdict feature means, or how to get Verdict technical support.

If it is product help, answer using ONLY VERDICT_PRODUCT_KNOWLEDGE below.
If it is a legal-rights, legal-procedure, legal-merits, legal-deadline, legal-remedy or general legal question, classify it as legal and DO NOT answer it here.
If a message contains both product help and a substantive legal question, classify it as legal so the verified legal pipeline can handle it.

Important:
- Understand natural wording and paraphrases. Do not depend on exact trigger phrases.
- Never invent buttons, routes, capabilities or instructions.
- If the product knowledge does not establish a requested detail, say that detail is not established by the current Verdict product information.
- Product-help answers must not include legal sources, legal referrals or a VERIFIED LEGAL GUIDANCE heading.
- Keep instructions practical and concise.

Return JSON only:
{
  "intent": "product_help" | "legal",
  "topic": "short product topic or empty string",
  "answer": "grounded product-help answer or empty string"
}

VERDICT_PRODUCT_KNOWLEDGE:
${productKnowledgeText()}`;

  try {
    const result = await generateText({
      systemPrompt,
      userText: q,
      maxTokens: 650,
      temperature: 0,
      jsonMode: true,
    });
    const parsed = parseJson(result?.text);
    if (parsed?.intent !== "product_help" || !String(parsed?.answer || "").trim()) {
      return null;
    }
    return {
      success: true,
      coverage: "product_help",
      intent: "product_help",
      productHelp: {
        topic: String(parsed.topic || "Verdict help").trim(),
        answer: String(parsed.answer).trim(),
      },
      message: String(parsed.answer).trim(),
      matches: [],
      safety: {
        generatedLegalAdvice: false,
        productKnowledgeOnly: true,
        attachmentUsedAsLegalSource: false,
      },
    };
  } catch (error) {
    console.warn("Verdict product-help routing unavailable:", error?.message || error);
    return null;
  }
}
