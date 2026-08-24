import { model, models, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, default: "" },
    role: { type: String, enum: ["ADMIN", "MANAGER", "AGENT"], default: "AGENT", index: true },
    status: { type: String, enum: ["INVITED", "ACTIVE", "SUSPENDED"], default: "INVITED", index: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = models.User || model("User", userSchema);
