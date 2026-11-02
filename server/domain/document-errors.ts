import { defineActionErrors } from "@agent-native/core/action";

import { workspaceErrors } from "./workspace.js";

export const documentErrors = defineActionErrors(
  "document_not_found",
  "invalid_document",
  "document_too_large",
  "document_parse_failed",
  "storage_unavailable",
  ...workspaceErrors.codes,
);
