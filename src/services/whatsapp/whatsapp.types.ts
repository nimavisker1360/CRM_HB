export const WHATSAPP_DIRECTIONS = ["OUTBOUND", "INBOUND"] as const;
export const WHATSAPP_MESSAGE_TYPES = ["TEXT", "TEMPLATE", "PROPERTY", "MATCH", "FOLLOWUP", "SYSTEM"] as const;
export const WHATSAPP_STATUSES = ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED"] as const;

export type WhatsAppDirection = (typeof WHATSAPP_DIRECTIONS)[number];
export type WhatsAppMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];
export type WhatsAppStatus = (typeof WHATSAPP_STATUSES)[number];

export type ProviderSendInput = {
  language?: string;
  media?: Array<{ type: "image" | "video"; url: string }>;
  templateName?: string;
  text?: string;
  to: string;
  transport: "TEMPLATE" | "TEXT";
};

export type ProviderSendResult = {
  providerMessageId: string;
  providerMessageIds: string[];
  status: "SENT";
};

export interface MessagingProvider {
  sendMessage(input: ProviderSendInput): Promise<ProviderSendResult>;
}

export type SendWhatsAppInput = {
  clientRequestId: string;
  customerId: string;
  followUpId?: string;
  language?: string;
  matchId?: string;
  messageType: WhatsAppMessageType;
  propertyId?: string;
  templateName?: string;
  text?: string;
};

export type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          id?: string;
          text?: { body?: string };
          timestamp?: string;
          type?: string;
        }>;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        statuses?: Array<{
          errors?: Array<{ code?: number; error_data?: { details?: string }; message?: string; title?: string }>;
          id?: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
        }>;
      };
    }>;
  }>;
  object?: string;
};

export class WhatsAppServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly httpStatus = 400,
    public readonly providerCode?: string,
  ) {
    super(code);
    this.name = "WhatsAppServiceError";
  }
}
