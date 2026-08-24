import { model, models, Schema, type InferSchemaType } from "mongoose";

const entitySchema = new Schema(
  {
    type: { type: String, enum: ["customer", "property", "match", "followup", "project", "agent"], required: true },
    entityId: { type: String, required: true },
    label: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const aiMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "AIConversation", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 20_000 },
    entities: { type: [entitySchema], default: [] },
    toolNames: { type: [String], default: [] },
  },
  { timestamps: true },
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

export type AIMessageDocument = InferSchemaType<typeof aiMessageSchema>;
export const AIMessage = models.AIMessage || model("AIMessage", aiMessageSchema);
