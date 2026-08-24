import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    recipientAgentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    importJobId: { type: Schema.Types.ObjectId, ref: "ImportJob", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    matchId: { type: Schema.Types.ObjectId, ref: "PropertyMatch", index: true },
    followUpId: { type: Schema.Types.ObjectId, ref: "FollowUp", index: true },
    automationJobId: { type: Schema.Types.ObjectId, ref: "AutomationJob", index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    body: { type: String, trim: true },
    type: {
      type: String,
      enum: [
        "NEW_MATCH",
        "FOLLOWUP_CREATED",
        "FOLLOWUP_DUE",
        "FOLLOWUP_OVERDUE",
        "CUSTOMER_ASSIGNED",
        "CUSTOMER_REASSIGNED",
        "INACTIVE_CUSTOMER",
        "PROPERTY_MATCH_FOUND",
        "IMPORT_COMPLETED",
        "IMPORT_PARTIAL",
        "IMPORT_FAILED",
        "AUTOMATION_FAILED",
        "AUTOMATION_PARTIAL",
        "SYSTEM",
      ],
      default: "SYSTEM",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["MATCH", "FOLLOWUP", "CUSTOMER", "IMPORT", "AUTOMATION", "SYSTEM"],
      default: "SYSTEM",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["UNREAD", "READ", "ARCHIVED"],
      default: "UNREAD",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
      required: true,
      index: true,
    },
    entityType: { type: String, trim: true, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    actionUrl: { type: String, trim: true },
    channels: [{ type: String, enum: ["IN_APP", "WHATSAPP", "EMAIL", "PUSH"], default: "IN_APP" }],
    deduplicationKey: { type: String, trim: true, unique: true, sparse: true },
    dedupeKey: { type: String, trim: true, unique: true, sparse: true },
    payload: { type: Schema.Types.Mixed },
    readAt: { type: Date, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientAgentId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ status: 1, type: 1, category: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });

const existingNotificationTypePath = models.Notification?.schema.path("type") as { enumValues?: string[] } | undefined;

if (
  models.Notification &&
  (!models.Notification.schema.path("recipientAgentId") || !existingNotificationTypePath?.enumValues?.includes("FOLLOWUP_CREATED"))
) {
  deleteModel("Notification");
}

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification =
  models.Notification || model("Notification", notificationSchema);
