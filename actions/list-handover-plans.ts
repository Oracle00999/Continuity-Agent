import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { documentWorkspaceInput } from "../shared/documents.js";
import { planListSchema } from "../shared/handover-plans.js";
import { listPlans, planErrors } from "../server/domain/handover-plans.js";
export default defineAction({
  description:
    "Read saved departure plans. Draft plans contain suggestions; approved assignments are separate from procedure readiness.",
  schema: documentWorkspaceInput,
  outputSchema: planListSchema,
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
  run: listPlans,
});
