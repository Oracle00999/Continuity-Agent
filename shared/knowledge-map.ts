import { z } from "zod";
import { documentWorkspaceInput } from "./documents.js";
import { knowledgeClaimSchema } from "./knowledge.js";
export const knowledgeMapInput = documentWorkspaceInput.extend({
  personId: z.string().min(1).max(200).optional(),
  nodeId: z.string().min(1).max(220).optional(),
  confirmedOnly: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .default(false),
});
export const mapNodeSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  kind: z.enum(["person", "system", "process", "document"]),
  name: z.string(),
  description: z.string().nullable(),
  departureDate: z.string().nullable(),
  urlPath: z.string().nullable(),
});
export const knowledgeMapSchema = z.object({
  workspaceId: z.string(),
  nodes: z.array(mapNodeSchema),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      relationship: z.string(),
      status: z.enum(["inferred", "confirmed"]),
      claimId: z.string(),
    }),
  ),
  selectedNode: mapNodeSchema.nullable(),
  selectedClaims: z.array(knowledgeClaimSchema),
  hasMore: z.boolean(),
  claimCount: z.number().int(),
});
