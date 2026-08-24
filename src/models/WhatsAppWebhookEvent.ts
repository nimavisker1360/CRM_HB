import { model, models, Schema, type InferSchemaType } from "mongoose";

const whatsappWebhookEventSchema = new Schema(
  {
    eventKey: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, enum: ["STATUS", "INBOUND"], required: true, index: true },
    providerMessageId: { type: String, trim: true, index: true },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

export type WhatsAppWebhookEventDocument = InferSchemaType<typeof whatsappWebhookEventSchema>;
export const WhatsAppWebhookEvent =
  models.WhatsAppWebhookEvent || model("WhatsAppWebhookEvent", whatsappWebhookEventSchema);
