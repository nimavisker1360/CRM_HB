import { model, models, Schema, type InferSchemaType } from "mongoose";

const followUpSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["CALL", "WHATSAPP", "EMAIL", "MEETING", "PROPERTY_VISIT", "OTHER"], default: "CALL" },
    channel: { type: String, enum: ["CALL", "WHATSAPP", "EMAIL", "MEETING"], default: "CALL" },
    status: { type: String, enum: ["PENDING", "COMPLETED", "CANCELLED", "OVERDUE", "OPEN", "DONE", "MISSED", "CANCELED"], default: "PENDING", index: true },
    scheduledAt: { type: Date, index: true },
    dueAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    lastReminderAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    overdueFlaggedAt: { type: Date },
    note: { type: String, trim: true },
    result: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    notes: { type: String, trim: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
  },
  { timestamps: true },
);

followUpSchema.index({ customerId: 1, agentId: 1, scheduledAt: 1, status: 1 });
followUpSchema.index({ status: 1, scheduledAt: 1, agentId: 1 });
followUpSchema.index({ status: 1, dueAt: 1, agentId: 1 });
followUpSchema.index({ agentId: 1, completedAt: -1, status: 1 });
followUpSchema.index({ agentId: 1, scheduledAt: -1, dueAt: -1, status: 1 });

export type FollowUpDocument = InferSchemaType<typeof followUpSchema>;
export const FollowUp = models.FollowUp || model("FollowUp", followUpSchema);
