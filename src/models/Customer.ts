import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    nationality: { type: String, trim: true },
    language: { type: String, trim: true, default: "Turkish" },
    status: {
      type: String,
      enum: [
        "NEW_LEAD",
        "CONTACTED",
        "QUALIFIED",
        "PROPERTY_SENT",
        "MEETING",
        "NEGOTIATION",
        "WON",
        "LOST",
        "FOLLOW_UP",
        "NEW",
      ],
      default: "NEW_LEAD",
      index: true,
    },
    source: { type: String, default: "Manual", trim: true },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    interestedCity: { type: String, trim: true, index: true },
    interestedDistrict: { type: String, trim: true },
    transactionType: { type: String, enum: ["SALE", "RENT"], default: "SALE" },
    propertyType: { type: String, trim: true },
    minBudget: { type: Number },
    maxBudget: { type: Number, index: true },
    currency: { type: String, enum: ["TRY", "USD", "EUR", "GBP"], default: "TRY" },
    minRooms: { type: Number },
    maxRooms: { type: Number },
    minArea: { type: Number },
    maxArea: { type: Number },
    citizenshipInterest: { type: Boolean, default: false },
    investmentInterest: { type: Boolean, default: false },
    residenceInterest: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    lastContact: { type: Date },
    lastActivityAt: { type: Date, index: true },
    nextFollowUp: { type: Date },
    matchingPending: { type: Boolean, default: true, index: true },
    matchingRequiredAt: { type: Date, default: Date.now },
    lastMatchedAt: { type: Date, index: true },
    matchCalculationVersion: { type: String, trim: true },
    importJobId: { type: Schema.Types.ObjectId, ref: "ImportJob", index: true },
    inactiveFlaggedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    preferredCities: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
  },
  { timestamps: true },
);

customerSchema.index(
  { fullName: "text", phone: "text", email: "text" },
  { default_language: "none", language_override: "textSearchLanguage", name: "customer_search_text" },
);
customerSchema.index({ assignedAgentId: 1, status: 1, phone: 1, email: 1, interestedCity: 1, maxBudget: 1, createdAt: -1 });
customerSchema.index({ assignedAgentId: 1, createdAt: -1, status: 1, source: 1 });
customerSchema.index({ assignedAgentId: 1, interestedCity: 1, interestedDistrict: 1, propertyType: 1, transactionType: 1, currency: 1 });
customerSchema.index({ matchingPending: 1, status: 1, _id: 1 });
customerSchema.index({ status: 1, lastActivityAt: 1, updatedAt: 1 });

export type CustomerDocument = InferSchemaType<typeof customerSchema>;

if (models.Customer && !models.Customer.schema.path("matchingPending")) {
  deleteModel("Customer");
}

export const Customer = models.Customer || model("Customer", customerSchema);
