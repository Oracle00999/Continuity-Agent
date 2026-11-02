import { splitAgentKitMessageContext } from "@agent-native/agentkit/chat-context";
import { appendAgentChatContextToMessage } from "@agent-native/core/client/agent-chat";

/** Presentation-only cleanup: the original request stays in hidden agent context. */
export function readableSuggestion(text: string): string {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return text
    .replace(
      /(?<![?&/\w])\b(?:documentId|workspaceId|personId|systemId|processId|runId|taskId|planId|findingId|evidenceId)\s*[=:]\s*["'`]?[^\s)\],;"'`]+["'`]?/gi,
      "",
    )
    .replace(new RegExp(`(?<![/=&\\w-])${uuid}(?![\\w-])`, "gi"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .trim();
}

export function cleanSuggestionMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanSuggestionMetadata);
  if (!value || typeof value !== "object") return value;
  if (
    "type" in value &&
    typeof value.type === "string" &&
    value.type !== "suggestions"
  )
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key !== "suggestions" || !Array.isArray(entry))
        return [key, cleanSuggestionMetadata(entry)];
      return [
        key,
        entry
          .map((item) => {
            if (
              !item ||
              typeof item !== "object" ||
              typeof item.label !== "string" ||
              typeof item.prompt !== "string"
            )
              return item;
            const label = readableSuggestion(item.label);
            const parts = splitAgentKitMessageContext(item.prompt);
            const prompt = readableSuggestion(parts.message);
            if (!label || !prompt) return null;
            return {
              ...item,
              label,
              prompt:
                prompt === parts.message
                  ? item.prompt
                  : appendAgentChatContextToMessage(
                      prompt,
                      `Original suggested request (reference context only):\n${item.prompt}`,
                    ),
            };
          })
          .filter(Boolean),
      ];
    }),
  );
}

/** Use the public transport fetch seam for live suggestions and restored threads. */
export function createReadableChatFetch(
  fetcher: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const response = await fetcher(input, init);
    if (!response.ok) return response;
    const type = response.headers.get("content-type") ?? "";
    if (
      !type.includes("application/json") &&
      !type.includes("text/event-stream")
    )
      return response;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    if (type.includes("application/json"))
      return new Response(
        JSON.stringify(cleanSuggestionMetadata(await response.json())),
        { status: response.status, statusText: response.statusText, headers },
      );
    if (!response.body) return response;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let pending = "";
    function line(value: string) {
      if (!value.startsWith("data:")) return value;
      try {
        return (
          "data: " +
          JSON.stringify(cleanSuggestionMetadata(JSON.parse(value.slice(5))))
        );
      } catch {
        return value;
      }
    }
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          pending += decoder.decode(chunk, { stream: true });
          let end: number;
          while ((end = pending.indexOf("\n")) >= 0) {
            controller.enqueue(
              encoder.encode(line(pending.slice(0, end)) + "\n"),
            );
            pending = pending.slice(end + 1);
          }
        },
        flush(controller) {
          pending += decoder.decode();
          if (pending) controller.enqueue(encoder.encode(line(pending)));
        },
      }),
    );
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
export const readableChatFetch = createReadableChatFetch();
