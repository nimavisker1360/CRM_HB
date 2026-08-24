import "server-only";

function intEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;
}

export const aiConfig = {
  provider: (process.env.AI_PROVIDER || "gemini").trim().toLowerCase(),
  model: (process.env.AI_MODEL || "gemini-3.5-flash").trim(),
  maxToolCalls: intEnv("AI_MAX_TOOL_CALLS", 6, 1, 12),
  maxContextItems: intEnv("AI_MAX_CONTEXT_ITEMS", 20, 1, 50),
  maxHistoryMessages: intEnv("AI_MAX_HISTORY_MESSAGES", 8, 0, 20),
  dailyAgentLimit: intEnv("AI_DAILY_REQUEST_LIMIT_AGENT", 50, 1, 10_000),
  dailyAdminLimit: intEnv("AI_DAILY_REQUEST_LIMIT_ADMIN", 200, 1, 10_000),
  minuteLimit: intEnv("AI_REQUESTS_PER_MINUTE", 8, 1, 60),
  timeoutMs: intEnv("AI_REQUEST_TIMEOUT_MS", 25_000, 5_000, 55_000),
  maxMessageLength: intEnv("AI_MAX_MESSAGE_LENGTH", 4_000, 200, 10_000),
  isConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
} as const;

export function publicAIStatus() {
  return {
    configured: aiConfig.isConfigured,
    model: aiConfig.model,
    provider: aiConfig.provider === "gemini" ? "Gemini" : aiConfig.provider,
  };
}
