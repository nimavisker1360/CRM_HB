import { z } from "zod";
import { AI_ENTITY_TYPES } from "@/services/ai/ai.types";

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  conversationId: z.string().trim().optional(),
  workspaceAgentId: z.string().trim().optional(),
}).strict();

export const aiEntitySchema = z.object({
  type: z.enum(AI_ENTITY_TYPES),
  id: z.string().min(1),
  label: z.string().min(1).max(240),
  url: z.string().regex(/^\/(customers|properties|matches|follow-ups|projects|agents)\/[A-Za-z0-9_-]+$/),
}).strict();

export const aiStructuredAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(20_000),
}).strict();
