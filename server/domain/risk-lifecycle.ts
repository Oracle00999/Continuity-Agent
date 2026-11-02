import { defineMachine } from "@agent-native/core/state-machine";
export const riskMachine = defineMachine({
  id: "continuity-risk",
  states: ["proposed", "accepted", "rejected", "resolved"],
  initial: "proposed",
  terminal: [],
  transitions: {
    proposed: {
      from: ["proposed", "accepted", "rejected", "resolved"],
      to: "proposed",
    },
    accepted: {
      from: ["proposed", "accepted", "rejected", "resolved"],
      to: "accepted",
    },
    rejected: {
      from: ["proposed", "accepted", "rejected", "resolved"],
      to: "rejected",
    },
    resolved: {
      from: ["proposed", "accepted", "rejected", "resolved"],
      to: "resolved",
    },
  },
});
