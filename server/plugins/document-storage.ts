import { defineNitroPlugin } from "@agent-native/core/server";

import { ensureLocalDocumentStorage } from "../storage/documents.js";

export default defineNitroPlugin(() => {
  ensureLocalDocumentStorage();
});
