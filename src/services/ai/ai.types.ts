import type { FunctionDeclaration } from "@google/genai";
import type { AgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";

export const AI_ENTITY_TYPES = ["customer", "property", "match", "followup", "project", "agent"] as const;
export type AIEntityType = (typeof AI_ENTITY_TYPES)[number];

export type AIEntity = {
  type: AIEntityType;
  id: string;
  label: string;
  url: string;
};

export type AIChatRequest = {
  message: string;
  conversationId?: string;
  workspaceAgentId?: string;
};

export type AIChatResponse = {
  answer: string;
  conversationId: string;
  entities: AIEntity[];
  toolsUsed: string[];
};

export type AIHistoryMessage = { role: "user" | "assistant"; content: string };

export type AIToolContext = {
  session: SessionUser;
  scope: AgentScope;
  maxItems: number;
  userMessage: string;
};

export type AIToolResult = {
  data: unknown;
  entities?: AIEntity[];
  meta?: { returned: number; total?: number; truncated?: boolean };
};

export type ApprovedAITool = {
  declaration: FunctionDeclaration;
  execute(args: unknown, context: AIToolContext): Promise<AIToolResult>;
};

export type AIProviderRequest = {
  message: string;
  history: AIHistoryMessage[];
  scopeDescription: string;
  tools: ApprovedAITool[];
  toolContext: AIToolContext;
};

export type AIProviderResponse = {
  answer: string;
  entities: AIEntity[];
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateResponse(input: AIProviderRequest): Promise<AIProviderResponse>;
}
