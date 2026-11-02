import { z } from "zod";
import { documentWorkspaceInput, writeReceiptSchema } from "./documents.js";
export const riskTypeSchema = z.enum([
  "single_owner_dependency",
  "documentation_gap",
  "conflicting_information",
  "unverified_procedure",
  "unclear_ownership",
]);
export const riskSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const riskStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "resolved",
]);
export const riskEvidenceInput = z.object({
  evidenceId: z.string().min(1).max(200),
  quote: z.string().trim().min(10).max(1500),
});
export const riskFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(20).max(2000),
  severity: riskSeveritySchema,
  severityReason: z.string().trim().min(10).max(1000),
  confidence: z.number().min(0).max(1),
  uncertainty: z.string().trim().min(10).max(1500),
  recommendedAction: z.string().trim().min(10).max(1500),
});
export const saveRisksInput = documentWorkspaceInput.extend({
  findings: z
    .array(
      riskFields.extend({
        key: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(120),
        type: riskTypeSchema,
        personId: z.string().min(1).max(200).optional(),
        systemId: z.string().min(1).max(200).optional(),
        processId: z.string().min(1).max(200).optional(),
        runId: z.string().min(1).max(200).optional(),
        evidence: z.array(riskEvidenceInput).min(1).max(6),
      }),
    )
    .min(1)
    .max(30),
});
export const riskIdInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
});
export const riskListInput = documentWorkspaceInput.extend({
  personId: z.string().min(1).max(200).optional(),
  status: riskStatusSchema.optional(),
});
export const riskSummarySchema = riskFields
  .pick({ title: true, severity: true })
  .extend({
    id: z.string(),
    workspaceId: z.string(),
    key: z.string(),
    type: riskTypeSchema,
    status: riskStatusSchema,
    personId: z.string().nullable(),
    personName: z.string().nullable(),
    systemId: z.string().nullable(),
    systemName: z.string().nullable(),
    processId: z.string().nullable(),
    processName: z.string().nullable(),
    runId: z.string().nullable(),
    revision: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    urlPath: z.string(),
  });
export const riskSchema = riskSummarySchema
  .merge(riskFields)
  .extend({
    reviewNotes: z.string(),
    reviewedBy: z.string().nullable(),
    evidence: z.array(
      z.object({
        evidenceId: z.string(),
        documentId: z.string(),
        sourceName: z.string(),
        quote: z.string(),
        urlPath: z.string(),
      }),
    ),
    verificationSnapshot: z
      .object({
        testerName: z.string(),
        status: z.string(),
        summary: z.string(),
        steps: z.array(
          z.object({
            number: z.number().int(),
            instruction: z.string(),
            result: z.string(),
            notes: z.string(),
          }),
        ),
        revision: z.number().int(),
        urlPath: z.string(),
      })
      .nullable(),
  });
export const riskListSchema = z.object({
  workspaceId: z.string(),
  findings: z.array(riskSummarySchema),
  hasMore: z.boolean(),
});
export const saveRisksOutput = z.object({
  findings: z.array(riskSummarySchema),
  insertedCount: z.number().int(),
  _receipt: writeReceiptSchema,
});
export const updateRiskInput = riskIdInput
  .merge(riskFields)
  .extend({
    revision: z.number().int().nonnegative(),
    status: riskStatusSchema,
    reviewNotes: z.string().trim().min(1).max(2000),
  });
export const updateRiskOutput = z.object({
  finding: riskSchema,
  _receipt: writeReceiptSchema,
});
