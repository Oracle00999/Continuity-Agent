import { describe, it, expect } from "vitest";
import {
  readableAnalystReply,
  analystReplyGuard,
} from "../server/domain/analyst-reply";
const id = "37c4e872-fc88-42f3-b865-db9f2d0f1573";
describe("Analyst readable links", () => {
  it("converts a bare finding URL into a named link and preserves the target", () => {
    expect(readableAnalystReply(`Saved at /risks?findingId=${id}.`)).toBe(
      `Saved at [Open finding](/risks?findingId=${id}).`,
    );
  });
  it("preserves named source links and exact quotation text", () => {
    const text = `The source says "Retrieve the backup." [Runbook](/documents?documentId=${id})`;
    expect(readableAnalystReply(text)).toBe(text);
  });
  it("hides internal references in product prose", () => {
    expect(readableAnalystReply(`Restore runbook (documentId=${id}).`)).toBe(
      "Restore runbook.",
    );
  });
});

it("does not treat a request to hide IDs as permission to display them", async () => {
  const context = {
    messages: [],
    assistantContent: [],
    toolCalls: [],
    toolResults: [],
    retryCount: 0,
    executionMode: "act" as const,
    text: `Saved finding ${id}.`,
  };
  expect(
    await analystReplyGuard({
      ...context,
      requestText: "Use names rather than internal IDs.",
    }),
  ).toBeTruthy();
  expect(
    await analystReplyGuard({ ...context, requestText: "Don't show raw IDs." }),
  ).toBeTruthy();
  expect(
    await analystReplyGuard({
      ...context,
      requestText: "Show raw IDs for this record.",
    }),
  ).toBeUndefined();
});
