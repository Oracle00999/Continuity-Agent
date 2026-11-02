import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  saveKnowledgeInput,
  saveKnowledgeOutput,
} from "../shared/knowledge.js";
import { saveKnowledge, knowledgeErrors } from "../server/domain/knowledge.js";
export default defineAction({
  description:
    "Save a validated batch of candidate person-to-system or person-to-process claims from one document. Read source first. Quotes must be exact and explicitly name both endpoints. Existing people/system IDs only; process names must occur in the quote. Every new claim needs human review. Retries preserve existing reviews.",
  schema: saveKnowledgeInput,
  outputSchema: saveKnowledgeOutput,
  errors: knowledgeErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
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
  run: saveKnowledge,
});
