import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { reviewPlanInput, planWriteSchema } from "../shared/handover-plans.js";
import { reviewPlan, planErrors } from "../server/domain/handover-plans.js";
export default defineAction({
  description:
    "Approve or reopen a plan with current revision and an explicit human review note. Approve only on explicit user instruction: all proposed tasks need owners and deadlines. Reopening allows additions without revoking previously confirmed assignments. Never changes tests or readiness.",
  schema: reviewPlanInput,
  outputSchema: planWriteSchema,
  errors: planErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
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
  run: reviewPlan,
});
