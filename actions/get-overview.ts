import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { documentWorkspaceInput } from "../shared/documents.js";
import { overviewSchema } from "../shared/overview.js";
import { getOverview } from "../server/domain/overview.js";
import { workspaceErrors } from "../server/domain/workspace.js";
export default defineAction({
  description:
    "Read the workspace Overview from one read-only snapshot: departures, complete aggregate counts, top open risks, confirmed unfinished tasks, separate assignment suggestions, latest reported run per runbook, ownership concentration candidates and recent activity. Proposed risks are included in open risk counts; rejected/resolved are excluded. A single documented owner is a candidate, not confirmed exclusivity. Test counts use only the latest attempt per source document; no metric proves readiness. No data or outcomes are changed.",
  schema: documentWorkspaceInput,
  outputSchema: overviewSchema,
  errors: workspaceErrors,
  http: { method: "GET" },
  readOnly: true,
  link: ({ result }) => ({
    url: buildDeepLink({
      app: "continuity",
      view: "overview",
      params: { workspaceId: result.workspace?.id },
    }),
    label: "Handover overview",
  }),
  run: getOverview,
});
