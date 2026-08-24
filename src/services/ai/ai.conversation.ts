import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import type { SessionUser } from "@/lib/auth/session";
import { AIConversation, AIMessage } from "@/models";
import type { AIEntity, AIHistoryMessage } from "@/services/ai/ai.types";

export async function resolveConversation(session: SessionUser, conversationId: string | undefined, agentId: string | undefined, titleSource: string) {
  await connectToDatabase();
  const userId = toId(session.userId);
  if (conversationId) {
    if (!Types.ObjectId.isValid(conversationId)) throw new Error("FORBIDDEN");
    const conversation = await AIConversation.findOne({ _id: conversationId, userId });
    if (!conversation) throw new Error("FORBIDDEN");
    const storedAgentId = conversation.agentId ? String(conversation.agentId) : undefined;
    if (storedAgentId !== agentId) throw new Error("CONVERSATION_SCOPE_MISMATCH");
    return conversation;
  }
  return AIConversation.create({ userId, agentId: agentId ? toId(agentId) : undefined, title: createTitle(titleSource), lastMessageAt: new Date() });
}

export async function getConversationHistory(session: SessionUser, conversationId: string, limit: number): Promise<AIHistoryMessage[]> {
  await assertConversationOwner(session, conversationId);
  const rows = await AIMessage.find({ conversationId }).sort({ createdAt: -1 }).limit(limit).select("role content").lean<Array<{ role: "user" | "assistant"; content: string }>>();
  return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
}

export async function saveAIMessage(conversationId: string, role: "user" | "assistant", content: string, entities: AIEntity[] = [], toolNames: string[] = []) {
  await Promise.all([
    AIMessage.create({ conversationId, role, content, entities: entities.map((item) => ({ ...item, entityId: item.id })), toolNames }),
    AIConversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: new Date() } }),
  ]);
}

export async function listAIConversations(session: SessionUser, limit = 12) {
  await connectToDatabase();
  const rows = await AIConversation.find({ userId: toId(session.userId) }).sort({ lastMessageAt: -1 }).limit(Math.min(limit, 30)).lean<Array<Record<string, unknown>>>();
  return rows.map((row) => ({ id: String(row._id), title: String(row.title), agentId: row.agentId ? String(row.agentId) : null, lastMessageAt: row.lastMessageAt instanceof Date ? row.lastMessageAt.toISOString() : String(row.lastMessageAt) }));
}

export async function getConversationMessages(session: SessionUser, conversationId: string) {
  await assertConversationOwner(session, conversationId);
  const rows = await AIMessage.find({ conversationId }).sort({ createdAt: 1 }).limit(100).select("role content entities createdAt").lean<Array<Record<string, unknown>>>();
  return rows.map((row) => ({ id: String(row._id), role: row.role, content: row.content, entities: ((row.entities || []) as Array<Record<string, unknown>>).map((item) => ({ type: item.type, id: item.entityId, label: item.label, url: item.url })), createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt) }));
}

export async function deleteAIConversation(session: SessionUser, conversationId: string) {
  await assertConversationOwner(session, conversationId);
  await Promise.all([AIMessage.deleteMany({ conversationId }), AIConversation.deleteOne({ _id: conversationId, userId: toId(session.userId) })]);
}

async function assertConversationOwner(session: SessionUser, conversationId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(conversationId)) throw new Error("FORBIDDEN");
  const exists = await AIConversation.exists({ _id: conversationId, userId: toId(session.userId) });
  if (!exists) throw new Error("FORBIDDEN");
}

function createTitle(message: string) { return message.trim().replace(/\s+/g, " ").slice(0, 80) || "گفتگوی جدید"; }
function toId(value: string) { if (!Types.ObjectId.isValid(value)) throw new Error("INVALID_ID"); return new Types.ObjectId(value); }
