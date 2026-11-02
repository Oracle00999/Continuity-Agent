import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  reviewKnowledgeInput,
  reviewKnowledgeOutput,
} from "../shared/knowledge.js";
import {
  reviewKnowledge,
  knowledgeErrors,
} from "../server/domain/knowledge.js";
export default defineAction({
  description:
    "Record an explicit human confirmation, rejection, or correction note on a candidate relationship using its current revision. Never confirm on behalf of a user without an explicit instruction. This does not establish procedure readiness.",
  schema: reviewKnowledgeInput,
  outputSchema: reviewKnowledgeOutput,
  errors: knowledgeErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
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
  run: reviewKnowledge,
});
