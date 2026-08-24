import "server-only";

import { randomUUID } from "node:crypto";
import { getAgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";
import { aiConfig } from "@/services/ai/ai.config";
import { getConversationHistory, resolveConversation, saveAIMessage } from "@/services/ai/ai.conversation";
import { createAIProvider } from "@/services/ai/ai.provider";
import { approvedAITools } from "@/services/ai/tools";
import type { AIChatRequest, AIChatResponse } from "@/services/ai/ai.types";
import { finishAIRequest, reserveAIRequest } from "@/services/ai/ai.usage";

export async function chatWithAI(session: SessionUser, input: AIChatRequest): Promise<AIChatResponse> {
  if (!aiConfig.isConfigured) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  if (input.message.length > aiConfig.maxMessageLength) throw new Error("AI_MESSAGE_TOO_LONG");
  const scope = getAgentScope(session, input.workspaceAgentId);
  const conversation = await resolveConversation(session, input.conversationId, scope.effectiveAgentId, input.message);
  const conversationId = String(conversation._id);
  const requestId = randomUUID();
  const startedAt = Date.now();
  await reserveAIRequest(session, requestId, conversationId);
  let toolNames: string[] = [];

  try {
    const history = await getConversationHistory(session, conversationId, aiConfig.maxHistoryMessages);
    await saveAIMessage(conversationId, "user", input.message);
    const provider = createAIProvider();
    const response = await provider.generateResponse({
      message: input.message,
      history,
      scopeDescription: describeScope(session, scope.effectiveAgentId),
      tools: approvedAITools,
      toolContext: { session, scope, maxItems: aiConfig.maxContextItems, userMessage: input.message },
    });
    toolNames = response.toolsUsed;
    await saveAIMessage(conversationId, "assistant", response.answer, response.entities, response.toolsUsed);
    await finishAIRequest(requestId, { conversationId, durationMs: Date.now() - startedAt, success: true, toolNames, ...response.usage });
    logAIRequest({ requestId, userId: session.userId, provider: provider.name, toolNames, duration: Date.now() - startedAt, success: true });
    return { answer: response.answer, conversationId, entities: response.entities, toolsUsed: response.toolsUsed };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    await finishAIRequest(requestId, { conversationId, durationMs: Date.now() - startedAt, success: false, errorCode, toolNames }).catch(() => undefined);
    logAIRequest({ requestId, userId: session.userId, provider: aiConfig.provider, toolNames, duration: Date.now() - startedAt, success: false, errorCode });
    throw error;
  }
}

function describeScope(session: SessionUser, effectiveAgentId?: string) {
  if (session.role === "AGENT") return `agent workspace for authenticated agent ${effectiveAgentId}; only that agent's customers, matches, follow-ups, and reports`;
  if (effectiveAgentId) return `admin/manager view restricted to agent workspace ${effectiveAgentId}`;
  return "authorized admin/manager company-wide view";
}

function safeErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  const allowed = ["AI_PROVIDER_NOT_CONFIGURED", "AI_PROVIDER_UNSUPPORTED", "AI_MALFORMED_RESPONSE", "AI_RATE_LIMITED", "AI_DAILY_LIMIT_REACHED", "AI_MESSAGE_TOO_LONG", "FORBIDDEN", "CONVERSATION_SCOPE_MISMATCH"];
  return allowed.includes(error.message) ? error.message : "PROVIDER_ERROR";
}

function logAIRequest(data: Record<string, unknown>) {
  console.info("[hb-ai]", JSON.stringify(data));
}
