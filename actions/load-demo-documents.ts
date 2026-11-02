import { defineAction } from "@agent-native/core/action";

import { documentErrors } from "../server/domain/document-errors.js";
import { loadDemoDocuments } from "../server/domain/documents.js";
import {
  demoDocumentsOutput,
  documentWorkspaceInput,
} from "../shared/documents.js";

export default defineAction({
  description:
    "Save the six fictional Northstar Digital runbooks and exact passages in one transaction. Deliberate documentation gaps are preserved. Repeated calls do not duplicate or overwrite sources.",
  schema: documentWorkspaceInput,
  outputSchema: demoDocumentsOutput,
  errors: documentErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  run: loadDemoDocuments,
});
