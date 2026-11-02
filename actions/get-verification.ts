import { buildDeepLink } from "@agent-native/core/command-navigation";
import { defineAction } from "@agent-native/core/action";
import {
  verificationIdInput,
  verificationSchema,
} from "../shared/verification.js";
import {
  getVerification,
  verificationErrors,
} from "../server/domain/verification.js";
export default defineAction({
  description: "Read one saved human test, source snapshot, steps and outcome.",
  schema: verificationIdInput,
  outputSchema: verificationSchema,
  errors: verificationErrors,
  http: { method: "GET" },
  readOnly: true,
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
  run: getVerification,
});
