import type { z } from "zod";
import type { activityKindSchema } from "../../shared/overview.js";
type Kind = z.infer<typeof activityKindSchema>;
/** Audit text may include raw status fields or review notes; expose a short title instead. */
export function activityPresentation(event: {
  eventType: string;
  summary: string;
}) {
  const map: Record<string, { kind: Kind; path: string }> = {
    demo_workspace_initialized: {
      kind: "workspace_loaded",
      path: "/workspace",
    },
    document_ingested: { kind: "document_saved", path: "/documents" },
    knowledge_extracted: { kind: "knowledge_saved", path: "/documents" },
    knowledge_reviewed: { kind: "knowledge_reviewed", path: "/documents" },
    risks_proposed: { kind: "risks_proposed", path: "/risks" },
    risk_reviewed: { kind: "risk_reviewed", path: "/risks" },
    verification_started: { kind: "test_started", path: "/verification" },
    verification_recorded: { kind: "test_results", path: "/verification" },
    verification_finalized: { kind: "test_finalized", path: "/verification" },
    handover_tasks_created: { kind: "tasks_created", path: "/tasks" },
    handover_task_updated: { kind: "task_updated", path: "/tasks" },
    handover_plan_drafted: { kind: "plan_drafted", path: "/handover" },
    handover_plan_reviewed: { kind: "plan_reopened", path: "/handover" },
    handover_suggestion_removed: {
      kind: "suggestion_removed",
      path: "/handover",
    },
  };
  const result = {
    ...(map[event.eventType] ?? {
      kind: "updated" as const,
      path: "/overview",
    }),
    detail: null as string | null,
  };
  if (event.eventType === "risk_reviewed")
    result.detail =
      event.summary.match(
        /^([\s\S]+): (?:proposed|accepted|rejected|resolved)\. Reviewer note:/,
      )?.[1] ?? null;
  if (event.eventType === "knowledge_reviewed")
    result.detail = event.summary.replace(
      /: (?:inferred|confirmed|rejected)\. Reviewer note:[\s\S]*$/,
      "",
    );
  if (event.eventType === "handover_task_updated")
    result.detail = event.summary
      .replace(/^Updated handover task: /, "")
      .replace(/\.$/, "");
  if (event.eventType === "handover_plan_reviewed") {
    const match = event.summary.match(/^(.+) plan (approved|reopened)\./);
    result.kind = match?.[2] === "approved" ? "plan_approved" : "plan_reopened";
    result.detail = match?.[1] ?? null;
  }
  if (event.eventType === "verification_finalized")
    result.detail = event.summary.replace(
      /: (?:passed|passed_with_gaps|failed)\.$/,
      "",
    );
  if (result.detail)
    result.detail =
      result.detail
        .replace(
          /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
          "",
        )
        .slice(0, 200)
        .trim() || null;
  return result;
}
