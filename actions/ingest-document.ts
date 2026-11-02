import { defineAction } from "@agent-native/core/action";

import { documentErrors } from "../server/domain/document-errors.js";
import { ingestDocument } from "../server/domain/documents.js";
import {
  ingestDocumentInput,
  ingestDocumentOutput,
} from "../shared/documents.js";

export default defineAction({
  description:
    "Process an uploaded PDF, Markdown or text AttachmentRef; save original-file reference, extracted text and exact evidence passages atomically. Repeat content reuses the existing document. No ownership or readiness is confirmed.",
  schema: ingestDocumentInput,
  outputSchema: ingestDocumentOutput,
  errors: documentErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  run: ingestDocument,
});
