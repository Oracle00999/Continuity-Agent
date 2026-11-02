import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { taskListInput, tasksListSchema } from "../shared/handover-tasks.js";
import { listTasks, taskErrors } from "../server/domain/handover-tasks.js";
export default defineAction({
  description: "List saved handover tasks, optionally for one test.",
  schema: taskListInput,
  outputSchema: tasksListSchema,
  errors: taskErrors,
  http: { method: "GET" },
  readOnly: true,
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
  run: listTasks,
});
