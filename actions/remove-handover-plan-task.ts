import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  removePlanTaskInput,
  planWriteSchema,
} from "../shared/handover-plans.js";
import { removePlanTask, planErrors } from "../server/domain/handover-plans.js";
export default defineAction({
  description:
    "Remove an explicitly unwanted suggested task from a draft departure plan with its current revision and a reason. Confirmed tasks cannot be removed. The plan and audit record persist.",
  schema: removePlanTaskInput,
  outputSchema: planWriteSchema,
  errors: planErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: true,
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
  run: removePlanTask,
});
