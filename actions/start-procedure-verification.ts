import { buildDeepLink } from "@agent-native/core/command-navigation";
import { defineAction } from "@agent-native/core/action";
import {
  startVerificationInput,
  verificationWriteSchema,
} from "../shared/verification.js";
import {
  startVerification,
  verificationErrors,
} from "../server/domain/verification.js";
export default defineAction({
  description:
    "Create a human verification checklist from exact numbered runbook lines. This records an assignment only; it executes nothing. Reuse requestId on retry.",
  schema: startVerificationInput,
  outputSchema: verificationWriteSchema,
  errors: verificationErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
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
  run: startVerification,
});
