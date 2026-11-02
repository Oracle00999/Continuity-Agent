import { z } from "zod";
import { documentWorkspaceInput, writeReceiptSchema } from "./documents.js";

export const stepResultSchema = z.enum([
  "pending",
  "completed",
  "blocked",
  "unclear",
]);
export const verificationStepSchema = z.object({
  number: z.number().int().positive(),
  instruction: z.string(),
  result: stepResultSchema,
  notes: z.string(),
});
export const verificationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  documentId: z.string(),
  sourceName: z.string(),
  sourceHash: z.string(),
  testerId: z.string(),
  testerName: z.string(),
  status: z.enum(["open", "passed", "passed_with_gaps", "failed"]),
  steps: z.array(verificationStepSchema),
  summary: z.string(),
  revision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  recordedBy: z.string(),
  urlPath: z.string(),
});
export const verificationSummarySchema = verificationSchema.omit({
  steps: true,
  summary: true,
  sourceHash: true,
  recordedBy: true,
});
export const verificationListSchema = z.object({
  workspaceId: z.string(),
  runs: z.array(verificationSummarySchema),
  hasMore: z.boolean(),
});
export const startVerificationInput = documentWorkspaceInput.extend({
  documentId: z.string().min(1).max(200),
  testerId: z.string().min(1).max(200),
  requestId: z
    .string()
    .uuid()
    .describe("Stable UUID for this start request; reuse on retry."),
});
export const verificationIdInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
});
export const recordVerificationInput = verificationIdInput.extend({
  revision: z.number().int().nonnegative(),
  results: z
    .array(
      z.object({
        number: z.number().int().positive(),
        result: stepResultSchema.exclude(["pending"]),
        notes: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(100),
});
export const finalizeVerificationInput = verificationIdInput.extend({
  revision: z.number().int().nonnegative(),
  outcome: z.enum(["passed", "passed_with_gaps", "failed"]),
  summary: z.string().trim().min(1).max(4000),
});
export const verificationWriteSchema = z.object({
  run: verificationSchema,
  _receipt: writeReceiptSchema,
});
export type VerificationStep = z.infer<typeof verificationStepSchema>;
