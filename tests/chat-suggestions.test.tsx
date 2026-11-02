// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { splitAgentKitMessageContext } from "@agent-native/agentkit/chat-context";
import {
  cleanSuggestionMetadata,
  createReadableChatFetch,
  readableSuggestion,
} from "../app/lib/chat-suggestions";
import { Button } from "../app/components/ui/button";
import { AppToolkitProvider } from "../app/components/ui/toolkit-provider";
const id = "29fd5719-c864-4105-b8dc-01346a5d563e";
const prompt = `Show the extracted passages for 'Database Backup & Restore.md' (documentId=${id}).`;
const suggestion = {
  id: "follow-up:1",
  runId: "run:1",
  label: "Review backup source",
  prompt,
};
afterEach(() => {
  document.body.innerHTML = "";
});
describe("readable chat suggestions", () => {
  it("hides reference fields but keeps the title and source link", () => {
    expect(readableSuggestion(prompt)).toBe(
      "Show the extracted passages for 'Database Backup & Restore.md'.",
    );
    expect(readableSuggestion(`[Source](/documents?documentId=${id})`)).toBe(
      `[Source](/documents?documentId=${id})`,
    );
  });
  it("keeps IDs available to the agent without displaying them, preserving suggestion identity", () => {
    const result = cleanSuggestionMetadata({
      type: "suggestions",
      suggestions: [suggestion],
    }) as { suggestions: (typeof suggestion)[] };
    expect(result.suggestions[0].id).toBe(suggestion.id);
    expect(result.suggestions[0].runId).toBe(suggestion.runId);
    const parts = splitAgentKitMessageContext(result.suggestions[0].prompt);
    expect(parts.message).not.toContain(id);
    expect(parts.context).toContain(id);
    expect(cleanSuggestionMetadata(result)).toEqual(result);
  });
  it("does not change normal messages or action results", () => {
    const value = {
      type: "tool_done",
      result: { suggestions: [suggestion] },
      text: prompt,
    };
    expect(cleanSuggestionMetadata(value)).toEqual(value);
  });
  it("cleans restored thread suggestions", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ thread: { suggestions: [suggestion] } }),
    );
    const response = await createReadableChatFetch(fetcher as typeof fetch)(
      "http://example.test/thread",
    );
    const data = await response.json();
    expect(
      splitAgentKitMessageContext(data.thread.suggestions[0].prompt).message,
    ).not.toContain(id);
  });
  it("handles split SSE chunks without dropping other events", async () => {
    const raw = `data: ${JSON.stringify({ type: "suggestions", suggestions: [suggestion] })}\n\ndata: ${JSON.stringify({ type: "text", text: "Restoration 🧭" })}\n\n`;
    const bytes = new TextEncoder().encode(raw);
    const fetcher = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              for (let i = 0; i < bytes.length; i += 7)
                c.enqueue(bytes.slice(i, i + 7));
              c.close();
            },
          }),
          {
            headers: {
              "content-type": "text/event-stream",
              "x-turn-id": "original",
            },
          },
        ),
    );
    const response = await createReadableChatFetch(fetcher as typeof fetch)(
      "http://example.test/chat",
    );
    expect(response.headers.get("x-turn-id")).toBe("original");
    const events = (await response.text())
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5)));
    expect(
      splitAgentKitMessageContext(events[0].suggestions[0].prompt).message,
    ).not.toContain(id);
    expect(events[1]).toEqual({ type: "text", text: "Restoration 🧭" });
  });
});
describe("suggestion activation", () => {
  it("moves focus to the composer after selection instead of leaving another chip ready for Enter", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <AppToolkitProvider>
          <div className="agentkit-composer-stack">
            <Button data-agent-suggestion-chip="true" onClick={onSelect}>
              Review runbook
            </Button>
            <textarea aria-label="Message" />
          </div>
        </AppToolkitProvider>,
      ),
    );
    const button = host.querySelector("button")!;
    button.focus();
    await act(async () => button.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(host.querySelector("textarea"));
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    button.focus();
    const repeat = new KeyboardEvent("keydown", {
      key: "Enter",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => button.dispatchEvent(repeat));
    expect(repeat.defaultPrevented).toBe(true);
    await act(async () => root.unmount());
  });
});
