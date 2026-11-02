import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  knowledgeListInput,
  knowledgeListSchema,
} from "../shared/knowledge.js";
import { listKnowledge, knowledgeErrors } from "../server/domain/knowledge.js";
export default defineAction({
  description:
    "Read saved source-backed candidate relationships and human reviews. Confidence is model confidence, never human confirmation.",
  schema: knowledgeListInput,
  outputSchema: knowledgeListSchema,
  errors: knowledgeErrors,
  http: { method: "GET" },
  readOnly: true,
  link: ({ args, result }) => ({
    url: buildDeepLink({
      app: "continuity",
      view: "documents",
      params: {
        workspaceId:
          result.workspaceId ??
          result.claim?.workspaceId ??
          result.claims?.[0]?.workspaceId,
        documentId: args.documentId ?? result.claim?.documentId,
      },
    }),
    label: "Document knowledge",
  }),
  run: listKnowledge,
});
