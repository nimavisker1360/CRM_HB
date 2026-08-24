import { model, models, Schema, type InferSchemaType } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    developer: { type: String, trim: true },
    description: { type: String, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    district: { type: String, trim: true },
    deliveryDate: { type: Date },
    paymentPlan: { type: String, trim: true },
    citizenshipSuitable: { type: Boolean, default: false },
    residenceSuitable: { type: Boolean, default: false },
    facilities: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    documents: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["PLANNED", "ACTIVE", "DELIVERED", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    assignedAgents: [{ type: Schema.Types.ObjectId, ref: "Agent" }],
  },
  { timestamps: true },
);

projectSchema.index({ name: "text", city: "text", district: "text" });
projectSchema.index({ name: 1, city: 1, district: 1, status: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema>;
export const Project = models.Project || model("Project", projectSchema);
