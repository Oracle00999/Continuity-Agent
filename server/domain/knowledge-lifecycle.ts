import { defineMachine } from "@agent-native/core/state-machine";
export const knowledgeMachine = defineMachine({
  id: "continuity-knowledge-review",
  states: ["inferred", "confirmed", "rejected"],
  initial: "inferred",
  terminal: [],
  transitions: {
    inferred: { from: ["inferred", "confirmed", "rejected"], to: "inferred" },
    confirmed: { from: ["inferred", "confirmed", "rejected"], to: "confirmed" },
    rejected: { from: ["inferred", "confirmed", "rejected"], to: "rejected" },
  },
});
