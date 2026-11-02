import { buildDeepLink } from "@agent-native/core/command-navigation";
import { defineAction } from "@agent-native/core/action";
import {
  finalizeVerificationInput,
  verificationWriteSchema,
} from "../shared/verification.js";
import {
  updateVerification,
  verificationErrors,
} from "../server/domain/verification.js";
export default defineAction({
  description:
    "Finalize the human-reported test outcome after all steps have results. Blocked steps prevent a pass. Does not establish overall handover readiness.",
  schema: finalizeVerificationInput,
  outputSchema: verificationWriteSchema,
  errors: verificationErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  link: ({ result }) => {
    const run = result.run ?? (result.id ? result : undefined);
    return {
      url: buildDeepLink({
        app: "continuity",
        view: "verification",
        params: {
          workspaceId: result.workspaceId ?? run?.workspaceId,
          runId: run?.id,
        },
      }),
      label: run?.sourceName ?? "Verification",
    };
  },
  run: updateVerification,
});
