import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const agentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    fullName: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true },
    avatarDataUrl: { type: String },
    role: { type: String, enum: ["ADMIN", "MANAGER", "AGENT"], default: "AGENT" },
    status: { type: String, enum: ["INVITED", "ACTIVE", "SUSPENDED"], default: "INVITED", index: true },
    languages: [{ type: String, trim: true }],
    specializedCities: [{ type: String, trim: true }],
    specializedDistricts: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true, index: true },
    territory: { type: String, trim: true },
    targetMonthlyDeals: { type: Number, default: 0 },
  },
  { timestamps: true },
);

agentSchema.index({ role: 1, isActive: 1, createdAt: -1 });

if (models.Agent && !models.Agent.schema.path("avatarDataUrl")) {
  deleteModel("Agent");
}

export type AgentDocument = InferSchemaType<typeof agentSchema>;
export const Agent = models.Agent || model("Agent", agentSchema);
