import { model, models, Schema, type InferSchemaType } from "mongoose";

const automationLockSchema = new Schema(
  {
    jobName: { type: String, required: true, unique: true, index: true, trim: true },
    lockedAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    runId: { type: String, required: true, index: true, trim: true },
  },
  { timestamps: true },
);

export type AutomationLockDocument = InferSchemaType<typeof automationLockSchema>;
export const AutomationLock = models.AutomationLock || model("AutomationLock", automationLockSchema);
