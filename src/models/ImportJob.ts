import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const importJobSchema = new Schema(
  {
    kind: { type: String, enum: ["CUSTOMERS", "PROPERTIES", "PROJECTS"], required: true, index: true },
    entityType: { type: String, enum: ["CUSTOMERS", "PROPERTIES", "PROJECTS"], index: true },
    status: {
      type: String,
      enum: ["QUEUED", "RUNNING", "UPLOADED", "VALIDATING", "READY", "IMPORTING", "COMPLETED", "PARTIAL", "FAILED"],
      default: "UPLOADED",
      index: true,
    },
    fileName: { type: String, trim: true },
    sourceFileName: { type: String, trim: true },
    fileSize: { type: Number, default: 0 },
    fileType: { type: String, trim: true },
    sheetName: { type: String, trim: true },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    matchingPending: { type: Boolean, default: false },
    matchingStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "PENDING", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED"],
      default: "NOT_REQUIRED",
      index: true,
    },
    matchingStartedAt: { type: Date },
    matchingCompletedAt: { type: Date },
    matchingProcessedCount: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    summary: { type: Schema.Types.Mixed },
    rowErrors: [
      {
        field: String,
        message: String,
        row: Number,
        value: Schema.Types.Mixed,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

export type ImportJobDocument = InferSchemaType<typeof importJobSchema>;

const existingStatusPath = models.ImportJob?.schema.path("status") as { enumValues?: string[] } | undefined;
const existingMatchingStatusPath = models.ImportJob?.schema.path("matchingStatus") as { enumValues?: string[] } | undefined;

if (
  models.ImportJob &&
  (!models.ImportJob.schema.path("entityType") ||
    !existingStatusPath?.enumValues?.includes("IMPORTING") ||
    !existingMatchingStatusPath?.enumValues?.includes("PROCESSING"))
) {
  deleteModel("ImportJob");
}

importJobSchema.index({ matchingStatus: 1, status: 1, createdAt: 1 });

export const ImportJob = models.ImportJob || model("ImportJob", importJobSchema);
