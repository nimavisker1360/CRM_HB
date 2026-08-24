import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const automationJobSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    runId: { type: String, required: true, unique: true, index: true, trim: true },
    type: {
      type: String,
      enum: [
        "DAILY_MATCHING",
        "NEW_PROPERTY_MATCHING",
        "PENDING_IMPORT_MATCHING",
        "FOLLOWUP_REMINDER",
        "OVERDUE_FOLLOWUP_CHECK",
        "INACTIVE_CUSTOMER_CHECK",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "SUCCESS", "PARTIAL", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    triggerType: { type: String, enum: ["CRON", "MANUAL", "SYSTEM"], required: true, index: true },
    schedule: { type: String, trim: true },
    startedAt: { type: Date, index: true },
    completedAt: { type: Date },
    processedCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    batchCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    errorMessage: { type: String, trim: true },
    errorDetails: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

automationJobSchema.index({ type: 1, status: 1, startedAt: -1 });
automationJobSchema.index({ status: 1, createdAt: -1 });
automationJobSchema.index({ triggerType: 1, createdAt: -1 });

export type AutomationJobDocument = InferSchemaType<typeof automationJobSchema>;

const existingTypePath = models.AutomationJob?.schema.path("type") as { enumValues?: string[] } | undefined;

if (models.AutomationJob && !existingTypePath?.enumValues?.includes("DAILY_MATCHING")) {
  deleteModel("AutomationJob");
}

export const AutomationJob =
  models.AutomationJob || model("AutomationJob", automationJobSchema);
