import { model, models, Schema, type InferSchemaType } from "mongoose";

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

aiConversationSchema.index({ userId: 1, lastMessageAt: -1 });

export type AIConversationDocument = InferSchemaType<typeof aiConversationSchema>;
export const AIConversation = models.AIConversation || model("AIConversation", aiConversationSchema);
