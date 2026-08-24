import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const propertyMatchSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    score: { type: Number, required: true, min: 0, max: 100, index: true },
    budgetScore: { type: Number },
    locationScore: { type: Number },
    roomsScore: { type: Number },
    propertyTypeScore: { type: Number },
    areaScore: { type: Number },
    specialRequirementsScore: { type: Number },
    breakdown: {
      budget: { max: Number, score: Number, evaluated: Boolean },
      location: { max: Number, score: Number, evaluated: Boolean },
      rooms: { max: Number, score: Number, evaluated: Boolean },
      propertyType: { max: Number, score: Number, evaluated: Boolean },
      area: { max: Number, score: Number, evaluated: Boolean },
      specialRequirements: { max: Number, score: Number, evaluated: Boolean },
    },
    reasons: [{ type: String, trim: true }],
    mismatches: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["NEW", "VIEWED", "SENT", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"],
      default: "NEW",
      index: true,
    },
    lastCalculatedAt: { type: Date, required: true, default: Date.now, index: true },
    calculationVersion: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

propertyMatchSchema.index({ customerId: 1, propertyId: 1 }, { unique: true });
propertyMatchSchema.index({ agentId: 1, status: 1, score: -1, createdAt: -1 });
propertyMatchSchema.index({ agentId: 1, createdAt: -1, status: 1, propertyId: 1 });
propertyMatchSchema.index({ customerId: 1, score: -1 });
propertyMatchSchema.index({ propertyId: 1, score: -1 });
propertyMatchSchema.index({ status: 1, score: -1, createdAt: -1 });

export type PropertyMatchDocument = InferSchemaType<typeof propertyMatchSchema>;

if (models.PropertyMatch && !models.PropertyMatch.schema.path("customerId")) {
  deleteModel("PropertyMatch");
}

export const PropertyMatch =
  models.PropertyMatch || model("PropertyMatch", propertyMatchSchema);
