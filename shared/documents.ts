import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT = 200_000;
export const documentWorkspaceInput = z.object({
  workspaceId: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Saved workspace ID; defaults to the caller's first workspace."),
});
export const documentIdInput = documentWorkspaceInput.extend({
  id: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Saved document ID returned by list-documents or ingest-document.",
    ),
});
export const mentionSchema = z.object({
  kind: z.enum(["person", "system"]),
  id: z.string(),
  name: z.string(),
});
export const evidenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  quote: z.string(),
  section: z.string().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  mentions: z.array(mentionSchema),
  citation: z.string(),
});
export const documentSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  source: z.enum(["demo", "upload"]),
  status: z.enum(["ready", "needs_text"]),
  byteSize: z.number().int().nonnegative(),
  uploadedAt: z.string(),
  passageCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});
export const documentDetailSchema = documentSummarySchema.extend({
  extractedText: z.string(),
  evidence: z.array(evidenceSchema),
  urlPath: z.string(),
  contentTrust: z.literal("untrusted_source_material"),
});
export const documentsListSchema = z.object({
  workspaceId: z.string(),
  documents: z.array(documentSummarySchema),
  hasMore: z.boolean(),
});
export const ingestDocumentInput = documentWorkspaceInput.extend({
  attachmentRef: z
    .string()
    .min(1)
    .max(4096)
    .describe(
      "Complete opaque AttachmentRef from document upload or an accessible uploaded attachment; never truncate it.",
    ),
});
export const writeReceiptSchema = z.object({
  changed: z.boolean(),
  verified: z.boolean(),
  subject: z.string(),
  summary: z.string(),
});
export const ingestDocumentOutput = z.object({
  document: documentDetailSchema,
  duplicate: z.boolean(),
  _receipt: writeReceiptSchema,
});
export const demoDocumentsOutput = z.object({
  workspaceId: z.string(),
  insertedCount: z.number().int().nonnegative(),
  documents: z.array(documentSummarySchema),
  _receipt: writeReceiptSchema,
});
export type DocumentMention = z.infer<typeof mentionSchema>;
