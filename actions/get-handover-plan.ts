import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { planIdInput, planSchema } from "../shared/handover-plans.js";
import { getPlan, planErrors } from "../server/domain/handover-plans.js";
export default defineAction({
  description:
    "Read a departure plan and its real persisted tasks, proposed or confirmed assignments, priorities, deadlines and risk links.",
  schema: planIdInput,
  outputSchema: planSchema,
  errors: planErrors,
  http: { method: "GET" },
  readOnly: true,
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
  run: getPlan,
});
