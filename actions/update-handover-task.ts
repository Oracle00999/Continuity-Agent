import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { updateTaskInput, taskWriteSchema } from "../shared/handover-tasks.js";
import { updateTask, taskErrors } from "../server/domain/handover-tasks.js";
export default defineAction({
  description:
    "Update a task with current revision, description and priority. Draft plan tasks remain suggested until plan approval and cannot start or finish; null owner/date is allowed only for suggestions. Resolving requires a description of the fix and never changes procedure verification or readiness. Reopen by setting todo or in_progress.",
  schema: updateTaskInput,
  outputSchema: taskWriteSchema,
  errors: taskErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  link: ({ result }) => {
    const task =
      result.task ??
      (result.id
        ? result
        : result.tasks?.length === 1
          ? result.tasks[0]
          : undefined);
    return {
      url: buildDeepLink({
        app: "continuity",
        view: "tasks",
        params: {
          workspaceId:
            result.workspaceId ??
            task?.workspaceId ??
            result.tasks?.[0]?.workspaceId,
          taskId: task?.id,
        },
      }),
      label: task?.title ?? "Handover tasks",
    };
  },
  run: updateTask,
});
