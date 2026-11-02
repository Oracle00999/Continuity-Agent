import { defineAction } from "@agent-native/core/action";

import {
  getWorkspaceContext,
  workspaceErrors,
} from "../server/domain/workspace.js";
import {
  workspaceContextSchema,
  workspaceInputSchema,
} from "../shared/workspace.js";

export default defineAction({
  description:
    "Read the caller's saved Continuity workspace, people and systems. Optional workspaceId and selectedPersonId scope the result. No saved workspace returns null; never infer readiness from these records.",
  schema: workspaceInputSchema,
  outputSchema: workspaceContextSchema,
  errors: workspaceErrors,
  http: { method: "GET" },
  readOnly: true,
  run: getWorkspaceContext,
});
