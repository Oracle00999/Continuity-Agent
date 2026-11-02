import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { draftPlanInput, planWriteSchema } from "../shared/handover-plans.js";
import { draftPlan, planErrors } from "../server/domain/handover-plans.js";
export default defineAction({
  description:
    "Atomically propose risk-linked tasks for a departing person. Owners and dates are suggestions only. One plan per person and one task per finding; retries preserve edits. Unresolved source-backed findings only; approved plans must be explicitly reopened for additions.",
  schema: draftPlanInput,
  outputSchema: planWriteSchema,
  errors: planErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  link: ({ result }) => {
    const plan = result.plan ?? (result.id ? result : undefined);
    return {
      url: buildDeepLink({
        app: "continuity",
        view: "handover",
        params: {
          workspaceId: result.workspaceId ?? plan?.workspaceId,
          planId: plan?.id,
        },
      }),
      label: plan ? `${plan.personName} handover` : "Departure handover",
    };
  },
  run: draftPlan,
});
