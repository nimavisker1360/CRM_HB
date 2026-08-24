import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

const activitySchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    entityType: {
      type: String,
      enum: ["USER", "AGENT", "CUSTOMER", "PROPERTY", "PROJECT", "MATCH", "FOLLOW_UP", "IMPORT_JOB", "AUTOMATION_JOB"],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type ActivityDocument = InferSchemaType<typeof activitySchema>;

const existingEntityTypePath = models.Activity?.schema.path("entityType") as { enumValues?: string[] } | undefined;

if (
  models.Activity &&
  (!existingEntityTypePath?.enumValues?.includes("IMPORT_JOB") ||
    !existingEntityTypePath.enumValues.includes("MATCH") ||
    !existingEntityTypePath.enumValues.includes("AUTOMATION_JOB"))
) {
  deleteModel("Activity");
}

export const Activity = models.Activity || model("Activity", activitySchema);
