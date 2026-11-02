import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { riskIdInput, riskSchema } from "../shared/risks.js";
import { getRisk, riskErrors } from "../server/domain/risks.js";
export default defineAction({
  description:
    "Read one saved assessment, exact evidence, uncertainty, severity rationale, human review and original verification gap snapshot.",
  schema: riskIdInput,
  outputSchema: riskSchema,
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
  run: getRisk,
});
