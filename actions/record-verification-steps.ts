import { buildDeepLink } from "@agent-native/core/command-navigation";
import { defineAction } from "@agent-native/core/action";
import {
  recordVerificationInput,
  verificationWriteSchema,
} from "../shared/verification.js";
import {
  updateVerification,
  verificationErrors,
} from "../server/domain/verification.js";
export default defineAction({
  description:
    "Save a batch of results explicitly reported by the human tester. Never infer or invent completed steps, evidence, or notes. Supply current revision.",
  schema: recordVerificationInput,
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
