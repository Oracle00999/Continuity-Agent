import { buildDeepLink } from "@agent-native/core/command-navigation";
import { defineAction } from "@agent-native/core/action";
import { documentWorkspaceInput } from "../shared/documents.js";
import { verificationListSchema } from "../shared/verification.js";
import {
  listVerifications,
  verificationErrors,
} from "../server/domain/verification.js";
export default defineAction({
  description: "Read saved human procedure verification records.",
  schema: documentWorkspaceInput,
  outputSchema: verificationListSchema,
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
  run: listVerifications,
});
