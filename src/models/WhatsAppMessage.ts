import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const whatsappMessageSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    direction: { type: String, enum: ["OUTBOUND", "INBOUND"], required: true, index: true },
    messageType: {
      type: String,
      enum: ["TEXT", "TEMPLATE", "PROPERTY", "MATCH", "FOLLOWUP", "SYSTEM"],
      required: true,
      index: true,
    },
    templateName: { type: String, trim: true },
    templateLanguage: { type: String, trim: true },
    recipientPhone: { type: String, trim: true, index: true },
    senderPhoneNumberId: { type: String, trim: true },
    text: { type: String, trim: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    matchId: { type: Schema.Types.ObjectId, ref: "PropertyMatch", index: true },
    followUpId: { type: Schema.Types.ObjectId, ref: "FollowUp", index: true },
    provider: { type: String, enum: ["META_CLOUD_API"], default: "META_CLOUD_API", index: true },
    providerMessageId: { type: String, trim: true, unique: true, sparse: true, index: true },
    providerMessageIds: [{ type: String, trim: true }],
    mediaUrls: [{ type: String, trim: true }],
    clientRequestId: { type: String, trim: true, unique: true, sparse: true, index: true },
    status: {
      type: String,
      enum: ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED"],
      default: "QUEUED",
      required: true,
      index: true,
    },
    errorCode: { type: String, trim: true },
    errorMessage: { type: String, trim: true },
    sentAt: { type: Date, index: true },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    lastInboundAt: { type: Date },
    providerTimestamp: { type: Date },
  },
  { timestamps: true },
);

whatsappMessageSchema.index({ customerId: 1, createdAt: -1 });
whatsappMessageSchema.index({ agentId: 1, direction: 1, status: 1, createdAt: -1 });
whatsappMessageSchema.index({ createdBy: 1, createdAt: -1 });

export type WhatsAppMessageDocument = InferSchemaType<typeof whatsappMessageSchema>;

if (models.WhatsAppMessage && (!models.WhatsAppMessage.schema.path("clientRequestId") || !models.WhatsAppMessage.schema.path("providerMessageIds"))) {
  deleteModel("WhatsAppMessage");
}

export const WhatsAppMessage = models.WhatsAppMessage || model("WhatsAppMessage", whatsappMessageSchema);
