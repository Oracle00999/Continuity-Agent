import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { updateRiskInput, updateRiskOutput } from "../shared/risks.js";
import { updateRisk, riskErrors } from "../server/domain/risks.js";
export default defineAction({
  description:
    "Edit or explicitly accept, reject, resolve or reopen an assessment with current revision and a human review note. Preserve evidence. Never fabricate fixes or resolve from task status alone. Procedure readiness and tests remain unchanged.",
  schema: updateRiskInput,
  outputSchema: updateRiskOutput,
  errors: riskErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
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
  run: updateRisk,
});
