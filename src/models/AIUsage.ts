import { model, models, Schema, type InferSchemaType } from "mongoose";

const aiUsageSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "AIConversation", index: true },
    provider: { type: String, required: true, index: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    success: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING", index: true },
    errorCode: { type: String, trim: true },
    toolNames: { type: [String], default: [] },
  },
  { timestamps: true },
);

aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ agentId: 1, createdAt: -1 });
aiUsageSchema.index({ provider: 1, createdAt: -1, success: 1 });

export type AIUsageDocument = InferSchemaType<typeof aiUsageSchema>;
export const AIUsage = models.AIUsage || model("AIUsage", aiUsageSchema);
