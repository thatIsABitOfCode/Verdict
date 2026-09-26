import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

const PROVIDERS = [
  {
    name: "groq",
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "qwen/qwen3.8-27b",
  },
  {
    name: "gemini",
    label: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-3.5-flash-lite",
  },
  {
    name: "mistral",
    label: "Mistral",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "ministral-14b-2512",
  },
];

function isConfigured(envName) {
  return Boolean(String(process.env[envName] || "").trim());
}

router.get("/ai-health", requireAdmin, async (req, res) => {
  try {
    const providers = PROVIDERS.map((provider, index) => {
      const configured = isConfigured(provider.keyEnv);

      return {
        name: provider.name,
        label: provider.label,
        priority: index + 1,
        configured,
        model:
          String(process.env[provider.modelEnv] || "").trim() ||
          provider.defaultModel,
        status: configured ? "configured" : "not_configured",
      };
    });

    const configuredCount = providers.filter(
      (provider) => provider.configured
    ).length;

    const timeoutMs =
      Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 20000;

    const groqSafeInputChars =
      Number(process.env.GROQ_SAFE_INPUT_CHARS) || 16000;

    res.json({
      overall: {
        status:
          configuredCount > 0
            ? "configured"
            : "no_providers_configured",
        configuredProviders: configuredCount,
        totalProviders: providers.length,
      },
      routing: {
        strategy: "ordered_fallback",
        providerOrder: providers.map((provider) => provider.name),
        timeoutMs,
        groqSafeInputChars,
        deterministicVerifiedDataFallback: true,
      },
      providers,
      safeguards: {
        legalGroundingRequired: true,
        providerAvailabilityDoesNotOverrideVerification: true,
        secretsExposed: false,
      },
      limitations: {
        liveProviderProbePerformed: false,
        persistentRequestMetricsAvailable: false,
        persistentSuccessRateAvailable: false,
        persistentLatencyMetricsAvailable: false,
        runtimeCooldownStateExposed: false,
      },
      generatedAt: new Date().toISOString(),
      note:
        "Provider configuration is derived from Verdict's server environment. This endpoint does not expose API keys, perform billable provider test requests, or claim live provider uptime.",
    });
  } catch (error) {
    console.error(
      "Admin AI health error:",
      error?.message || error
    );

    res.status(500).json({
      error: "Unable to load Verdict AI health information.",
    });
  }
});

export default router;
