import { defineAction } from "@agent-native/core/action";

import { documentErrors } from "../server/domain/document-errors.js";
import { listDocuments } from "../server/domain/documents.js";
import {
  documentsListSchema,
  documentWorkspaceInput,
} from "../shared/documents.js";

export default defineAction({
  description:
    "List up to 100 saved workspace documents with extraction status and warnings; read an individual source with get-document before citing it.",
  schema: documentWorkspaceInput,
  outputSchema: documentsListSchema,
  errors: documentErrors,
  http: { method: "GET" },
  readOnly: true,
  run: listDocuments,
});
