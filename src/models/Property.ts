import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const propertySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    propertyCode: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, trim: true },
    transactionType: { type: String, enum: ["SALE", "RENT"], required: true, index: true },
    propertyType: {
      type: String,
      enum: ["APARTMENT", "VILLA", "LAND", "COMMERCIAL", "OFFICE", "SHOP"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["APARTMENT", "VILLA", "LAND", "COMMERCIAL"],
      default: "APARTMENT",
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESERVED", "SOLD", "RENTED", "PASSIVE", "DRAFT", "AVAILABLE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    city: { type: String, required: true, trim: true, index: true },
    district: { type: String, trim: true, index: true },
    neighborhood: { type: String, trim: true },
    address: { type: String, trim: true },
    price: { type: Number, default: 0, index: true },
    currency: { type: String, enum: ["TRY", "USD", "EUR", "GBP"], default: "TRY" },
    rooms: { type: Number, index: true },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    grossArea: { type: Number, default: 0 },
    netArea: { type: Number },
    areaSqm: { type: Number },
    floor: { type: Number },
    totalFloors: { type: Number },
    buildingAge: { type: Number },
    furnished: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    pool: { type: Boolean, default: false },
    socialFacilities: [{ type: String, trim: true }],
    citizenshipSuitable: { type: Boolean, default: false },
    residencePermitSuitable: { type: Boolean, default: false },
    images: [{ type: String, trim: true }],
    videoUrl: { type: String, trim: true },
    source: { type: String, trim: true, default: "Manual" },
    sourceUrl: { type: String, trim: true },
    matchingPending: { type: Boolean, default: true, index: true },
    matchingRequiredAt: { type: Date, default: Date.now },
    lastMatchedAt: { type: Date, index: true },
    matchCalculationVersion: { type: String, trim: true },
    importJobId: { type: Schema.Types.ObjectId, ref: "ImportJob", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    coverImageUrl: { type: String, trim: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

propertySchema.index({ title: "text", propertyCode: "text", city: "text", district: "text" });
propertySchema.index({ status: 1, city: 1, district: 1, price: 1, rooms: 1, assignedAgentId: 1, projectId: 1, createdAt: -1 });
propertySchema.index({ status: 1, projectId: 1, createdAt: -1 });
propertySchema.index({ matchingPending: 1, status: 1, _id: 1 });

export type PropertyDocument = InferSchemaType<typeof propertySchema>;

if (models.Property && !models.Property.schema.path("matchingPending")) {
  deleteModel("Property");
}

export const Property = models.Property || model("Property", propertySchema);
