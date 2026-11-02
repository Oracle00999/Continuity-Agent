import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/command-navigation";
import { taskIdInput, taskSchema } from "../shared/handover-tasks.js";
import { getTask, taskErrors } from "../server/domain/handover-tasks.js";
export default defineAction({
  description: "Read one task, original blocker, source links and resolution.",
  schema: taskIdInput,
  outputSchema: taskSchema,
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
  run: getTask,
});
