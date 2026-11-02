import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { riskListInput, riskListSchema } from "../shared/risks.js";
import { listRisks, riskErrors } from "../server/domain/risks.js";
export default defineAction({
  description:
    "Read saved risk assessments, optionally filtered by person or review status. Results are ordered by severity; rejected/resolved findings remain available.",
  schema: riskListInput,
  outputSchema: riskListSchema,
  errors: riskErrors,
  http: { method: "GET" },
  readOnly: true,
  link: ({ result }) => {
    const finding =
      result.finding ??
      (result.id
        ? result
        : result.findings?.length === 1
          ? result.findings[0]
          : undefined);
    return {
      url: buildDeepLink({
        app: "continuity",
        view: "risks",
        params: {
          workspaceId:
            result.workspaceId ??
            finding?.workspaceId ??
            result.findings?.[0]?.workspaceId,
          findingId: finding?.id,
        },
      }),
      label: finding?.title ?? "Risk register",
    };
  },
  run: listRisks,
});
