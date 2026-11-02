import { defineMachine } from "@agent-native/core/state-machine";
export const verificationMachine = defineMachine({
  id: "continuity-verification",
  states: ["open", "passed", "passed_with_gaps", "failed"],
  initial: "open",
  terminal: ["passed", "passed_with_gaps", "failed"],
  transitions: {
    record: { from: ["open"], to: "open" },
    passed: { from: ["open"], to: "passed" },
    passed_with_gaps: { from: ["open"], to: "passed_with_gaps" },
    failed: { from: ["open"], to: "failed" },
  },
});
