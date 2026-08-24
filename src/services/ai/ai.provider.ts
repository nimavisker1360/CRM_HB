import "server-only";

import { aiConfig } from "@/services/ai/ai.config";
import { GeminiProvider } from "@/services/ai/providers/gemini.provider";
import type { AIProvider } from "@/services/ai/ai.types";

export function createAIProvider(): AIProvider {
  if (aiConfig.provider === "gemini") return new GeminiProvider();
  throw new Error("AI_PROVIDER_UNSUPPORTED");
}
