import type { AgentLoopFinalResponseGuard } from "@agent-native/core/server";
const uuid =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const markdownLink = /\[[^\]\n]+\]\([^\s)]+\)/g;
/** Keep IDs in named link targets, never in normal product prose. */
export function readableAnalystReply(text: string) {
  const links: string[] = [];
  const protect = (link: string) => {
    const token = `\uE000${links.length}\uE001`;
    links.push(link);
    return token;
  };
  let result = text.replace(markdownLink, protect);
  result = result.replace(
    /\/(?:risks|documents|verification|tasks|knowledge-map|handover|overview|workspace)\?[^\s<>]+/g,
    (path) => {
      const suffix = path.match(/[.,;!]+$/)?.[0] ?? "";
      const url = suffix ? path.slice(0, -suffix.length) : path;
      const label = url.startsWith("/risks")
        ? "Open finding"
        : url.startsWith("/documents")
          ? "View source"
          : url.startsWith("/tasks")
            ? "Open task"
            : url.startsWith("/verification")
              ? "View test"
              : "Open workspace";
      return protect(`[${label}](${url})`) + suffix;
    },
  );
  result = result
    .replace(
      /\b(?:documentId|workspaceId|findingId|personId|systemId|processId|runId|taskId|planId|evidenceId)\s*[=:]\s*["'`]?[^\s)\],;"'`]+["'`]?/gi,
      "",
    )
    .replace(uuid, "")
    .replace(/\(\s*\)/g, "")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/ {2,}/g, " ");
  return result
    .replace(/\uE000(\d+)\uE001/g, (_match, index) => links[Number(index)]!)
    .trim();
}
export const analystReplyGuard: AgentLoopFinalResponseGuard = (context) => {
  const request = context.requestText ?? "";
  const explicit =
    /\b(?:show|print|display|include|return|give me)\s+(?:the\s+)?(?:(?:raw|internal|database)\s+(?:record\s+)?ids?|technical diagnostics|debug details)\b/gi;
  const asksForIds = [...request.matchAll(explicit)].some(
    (match) =>
      !/(?:do not|don't|dont|never|not)\s*$/i.test(
        request.slice(Math.max(0, match.index! - 20), match.index),
      ),
  );
  if (asksForIds) return;
  const visible = context.text.replace(markdownLink, "");
  uuid.lastIndex = 0;
  if (!uuid.test(visible)) return;
  return {
    maxRetries: 1,
    retryMessage:
      "Rewrite the final answer using names and natural language. Put every record ID or app path only inside the target of a named Markdown link, never visible prose or bare URLs. Keep the verified result and uncertainty, do not perform more work, and do not repeat technical context. Use a concise response; do not add a closing offer menu.",
    fallbackMessage: readableAnalystReply(context.text),
  };
};
