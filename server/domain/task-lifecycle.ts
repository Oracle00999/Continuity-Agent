import { defineMachine } from "@agent-native/core/state-machine";
export const taskMachine = defineMachine({
  id: "continuity-handover-task",
  states: ["todo", "in_progress", "done"],
  initial: "todo",
  terminal: [],
  transitions: {
    todo: { from: ["todo", "in_progress", "done"], to: "todo" },
    in_progress: { from: ["todo", "in_progress", "done"], to: "in_progress" },
    done: { from: ["todo", "in_progress", "done"], to: "done" },
  },
});
