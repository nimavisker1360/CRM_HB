import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import type { SessionUser } from "@/lib/auth/session";
import { AIUsage } from "@/models";
import { aiConfig } from "@/services/ai/ai.config";

export async function reserveAIRequest(session: SessionUser, requestId: string, conversationId?: string) {
  await connectToDatabase();
  const userId = toId(session.userId);
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const [minuteCount, dayCount] = await Promise.all([
    AIUsage.countDocuments({ userId, createdAt: { $gte: minuteAgo } }),
    AIUsage.countDocuments({ userId, createdAt: { $gte: dayStart } }),
  ]);
  assertAIUsageAllowed(session, minuteCount, dayCount);
  return AIUsage.create({
    requestId, userId, agentId: session.agentId ? toId(session.agentId) : undefined,
    conversationId: conversationId ? toId(conversationId) : undefined,
    provider: aiConfig.provider, model: aiConfig.model, status: "PENDING", success: false,
  });
}

export function assertAIUsageAllowed(session: SessionUser, minuteCount: number, dayCount: number) {
  if (minuteCount >= aiConfig.minuteLimit) throw new Error("AI_RATE_LIMITED");
  const dailyLimit = session.role === "AGENT" ? aiConfig.dailyAgentLimit : aiConfig.dailyAdminLimit;
  if (dayCount >= dailyLimit) throw new Error("AI_DAILY_LIMIT_REACHED");
}

export async function finishAIRequest(requestId: string, data: { conversationId?: string; durationMs: number; success: boolean; errorCode?: string; toolNames?: string[]; inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
  await AIUsage.updateOne({ requestId }, { $set: {
    conversationId: data.conversationId ? toId(data.conversationId) : undefined,
    durationMs: data.durationMs, success: data.success, status: data.success ? "SUCCESS" : "FAILED", errorCode: data.errorCode,
    toolNames: data.toolNames || [], inputTokens: data.inputTokens || 0, outputTokens: data.outputTokens || 0, totalTokens: data.totalTokens || 0,
  } });
}

export async function getAIUsageSummary() {
  await connectToDatabase();
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const [todayCount, monthCount, failed, byAgent] = await Promise.all([
    AIUsage.countDocuments({ createdAt: { $gte: today } }),
    AIUsage.countDocuments({ createdAt: { $gte: month } }),
    AIUsage.countDocuments({ createdAt: { $gte: month }, status: "FAILED" }),
    AIUsage.aggregate([
      { $match: { createdAt: { $gte: month } } },
      { $group: { _id: "$agentId", requests: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } } } },
      { $sort: { requests: -1 } }, { $limit: 20 },
      { $lookup: { from: "agents", localField: "_id", foreignField: "_id", as: "agent" } },
      { $set: { agent: { $first: "$agent" } } },
    ]),
  ]);
  return { today: todayCount, thisMonth: monthCount, failedThisMonth: failed, byAgent: byAgent.map((row) => ({ agentId: row._id ? String(row._id) : null, agentName: row.agent?.fullName || row.agent?.name || (row._id ? "مشاور حذف‌شده" : "مدیر / نمای شرکت"), requests: row.requests, failures: row.failures })) };
}

function toId(value: string) {
  if (!Types.ObjectId.isValid(value)) throw new Error("INVALID_ID");
  return new Types.ObjectId(value);
}
