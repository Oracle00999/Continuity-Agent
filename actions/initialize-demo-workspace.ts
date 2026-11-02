import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  initializeDemoWorkspace,
  workspaceErrors,
} from "../server/domain/workspace.js";
import { workspaceContextSchema } from "../shared/workspace.js";

export default defineAction({
  description:
    "Load the fictional Northstar Digital demo for the signed-in caller. Creates five people and six systems once; subsequent calls preserve existing records and departure date.",
  schema: z.object({}),
  outputSchema: workspaceContextSchema,
  errors: workspaceErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  run: async (_input, context) => initializeDemoWorkspace(context),
});
