import { Types } from "mongoose";
import { Agent, User } from "@/models";
import type { IdLike } from "@/services/notifications/notification.types";

export function toObjectId(value?: IdLike | null) {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  if (Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  return undefined;
}

export async function resolveAgentRecipient(agentId?: IdLike | null) {
  const _id = toObjectId(agentId);
  if (!_id) return {};

  const agent = await Agent.findById(_id).select("_id user userId").lean<Record<string, unknown> | null>();
  return {
    recipientAgentId: _id,
    recipientUserId: toObjectId(agent?.userId as IdLike | undefined) || toObjectId(agent?.user as IdLike | undefined),
  };
}

export async function resolveAdminRecipients() {
  return User.find({ role: "ADMIN", status: "ACTIVE" }).select("_id").lean<Array<{ _id: Types.ObjectId }>>();
}
