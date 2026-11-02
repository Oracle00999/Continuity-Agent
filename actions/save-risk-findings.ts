import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { saveRisksInput, saveRisksOutput } from "../shared/risks.js";
import { saveRisks, riskErrors } from "../server/domain/risks.js";
export default defineAction({
  description:
    "Atomically save source-linked risk assessments as proposed. Exact quotes are required; uncertainty and severity rationale must be explicit. Use stable semantic keys and read existing findings first. Repeated keys preserve existing reviews and evidence, without overwriting. This records assessments, not proven facts or readiness.",
  schema: saveRisksInput,
  outputSchema: saveRisksOutput,
  errors: riskErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
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
  run: saveRisks,
});
