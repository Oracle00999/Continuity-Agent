import { z } from "zod";
import { documentWorkspaceInput, writeReceiptSchema } from "./documents.js";
import { dueDateSchema, taskSummarySchema } from "./handover-tasks.js";
import { riskSeveritySchema } from "./risks.js";
export const planSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  personId: z.string(),
  personName: z.string(),
  departureDate: z.string(),
  status: z.enum(["draft", "approved"]),
  revision: z.number().int(),
  reviewNotes: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  urlPath: z.string(),
});
export const planSchema = planSummarySchema.extend({
  tasks: z.array(taskSummarySchema.extend({ description: z.string() })),
  hasMore: z.boolean(),
});
export const planIdInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
});
export const planListSchema = z.object({
  workspaceId: z.string(),
  plans: z.array(planSummarySchema),
  hasMore: z.boolean(),
});
export const draftPlanInput = documentWorkspaceInput.extend({
  personId: z.string().min(1).max(200),
  tasks: z
    .array(
      z.object({
        findingId: z.string().min(1).max(200),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(10).max(2000),
        priority: riskSeveritySchema,
        assigneeId: z.string().min(1).max(200).nullable(),
        dueDate: dueDateSchema.nullable(),
      }),
    )
    .min(1)
    .max(30),
});
export const reviewPlanInput = planIdInput.extend({
  revision: z.number().int().nonnegative(),
  decision: z.enum(["approve", "reopen"]),
  notes: z.string().trim().min(1).max(2000),
});
export const planWriteSchema = z.object({
  plan: planSchema,
  insertedCount: z.number().int(),
  _receipt: writeReceiptSchema,
});
export const removePlanTaskInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(1000),
});
