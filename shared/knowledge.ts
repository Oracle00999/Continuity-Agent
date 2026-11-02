import { z } from "zod";
import { documentWorkspaceInput, writeReceiptSchema } from "./documents.js";
export const knowledgeStateSchema = z.enum([
  "inferred",
  "confirmed",
  "rejected",
]);
export const claimInputSchema = z.object({
  personId: z.string().min(1).max(200),
  relationship: z.enum(["owns", "maintains", "operates", "supports"]),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("system"), id: z.string().min(1).max(200) }),
    z.object({
      kind: z.literal("process"),
      name: z.string().trim().min(3).max(120),
    }),
  ]),
  evidenceId: z.string().min(1).max(200),
  quote: z.string().trim().min(10).max(1500),
  confidence: z.number().min(0).max(1),
});
export const saveKnowledgeInput = documentWorkspaceInput.extend({
  documentId: z.string().min(1).max(200),
  claims: z.array(claimInputSchema).min(1).max(50),
});
export const knowledgeListInput = documentWorkspaceInput.extend({
  documentId: z.string().min(1).max(200).optional(),
  personId: z.string().min(1).max(200).optional(),
});
export const knowledgeClaimSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  documentId: z.string(),
  sourceName: z.string(),
  personId: z.string(),
  personName: z.string(),
  relationship: claimInputSchema.shape.relationship,
  targetKind: z.enum(["system", "process"]),
  targetId: z.string(),
  targetName: z.string(),
  evidenceId: z.string(),
  quote: z.string(),
  confidence: z.number(),
  status: knowledgeStateSchema,
  reviewNotes: z.string(),
  revision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedBy: z.string().nullable(),
  urlPath: z.string(),
});
export const knowledgeListSchema = z.object({
  workspaceId: z.string(),
  claims: z.array(knowledgeClaimSchema),
  hasMore: z.boolean(),
});
export const saveKnowledgeOutput = z.object({
  claims: z.array(knowledgeClaimSchema),
  insertedCount: z.number().int(),
  _receipt: writeReceiptSchema,
});
export const reviewKnowledgeInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  status: knowledgeStateSchema,
  notes: z.string().trim().min(1).max(2000),
});
export const reviewKnowledgeOutput = z.object({
  claim: knowledgeClaimSchema,
  _receipt: writeReceiptSchema,
});
