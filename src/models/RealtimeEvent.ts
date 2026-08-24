import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const realtimeEventSchema = new Schema(
  {
    agentId: { type: String, index: true },
    eventId: { type: String, required: true, unique: true, index: true },
    followUpId: { type: String },
    notificationId: { type: String },
    resource: { type: String, enum: ["agents", "follow-ups", "notifications"] },
    type: {
      type: String,
      enum: ["agent.avatar.updated", "followup.created", "notification.created"],
      required: true,
      index: true,
    },
    userId: { type: String, index: true },
  },
  { timestamps: true },
);

// Realtime events only bridge short disconnects; source records remain permanent.
realtimeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });
realtimeEventSchema.index({ agentId: 1, createdAt: 1 });
realtimeEventSchema.index({ userId: 1, createdAt: 1 });

const existingRealtimeModel = models.RealtimeEvent;
const existingEventTypes = existingRealtimeModel?.schema.path("type")?.options?.enum as string[] | undefined;
if (existingRealtimeModel && (!existingRealtimeModel.schema.path("eventId") || !existingEventTypes?.includes("agent.avatar.updated"))) {
  deleteModel("RealtimeEvent");
}

export type RealtimeEventDocument = InferSchemaType<typeof realtimeEventSchema>;
export const RealtimeEvent =
  models.RealtimeEvent || model("RealtimeEvent", realtimeEventSchema);
