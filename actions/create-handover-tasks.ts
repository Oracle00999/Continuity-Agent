import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import {
  createTasksInput,
  tasksWriteSchema,
} from "../shared/handover-tasks.js";
import { createTasks, taskErrors } from "../server/domain/handover-tasks.js";
export default defineAction({
  description:
    "Atomically create tasks for saved blocked or unclear verification steps, with owner and calendar deadline. One task per test step; retries return existing tasks without overwriting them. Supply current sourceRevision.",
  schema: createTasksInput,
  outputSchema: tasksWriteSchema,
  errors: taskErrors,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
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
  run: createTasks,
});
