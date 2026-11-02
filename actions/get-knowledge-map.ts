import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  knowledgeMapInput,
  knowledgeMapSchema,
} from "../shared/knowledge-map.js";
import { getKnowledgeMap } from "../server/domain/knowledge-map.js";
import { knowledgeErrors } from "../server/domain/knowledge.js";
export default defineAction({
  description:
    "Read the evidence-backed knowledge graph: people, systems, processes and source documents. Optional personId focuses one person; confirmedOnly hides unreviewed claims. Rejected claims are excluded. Selected node details include exact evidence. A graph connection never proves exclusive ownership, backup coverage, or operational readiness. Results are bounded at 150 claims; hasMore means the graph is incomplete.",
  schema: knowledgeMapInput,
  outputSchema: knowledgeMapSchema,
  errors: knowledgeErrors,
  http: { method: "GET" },
  readOnly: true,
  link: ({ args, result }) => ({
    url: buildDeepLink({
      app: "continuity",
      view: "knowledge-map",
      params: {
        workspaceId: result.workspaceId,
        personId: args.personId,
        nodeId: args.nodeId,
        confirmedOnly: args.confirmedOnly ? "true" : undefined,
      },
    }),
    label: "Knowledge map",
  }),
  run: getKnowledgeMap,
});
