import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { planSchema } from "../../shared/handover-plans";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type Plan = z.infer<typeof planSchema>;
export function meta() {
  return [{ title: "Departure Handover — Continuity" }];
}
export default function HandoverRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const active = workspace.data?.workspace?.id;
  const personId =
    params.get("personId") ??
    workspace.data?.people.find((p) => p.departureDate)?.id ??
    "";
  const plans = useActionQuery(
    "list-handover-plans",
    { workspaceId: active },
    { enabled: Boolean(active) },
  );
  const id =
    params.get("planId") ??
    plans.data?.plans.find((p) => p.personId === personId)?.id ??
    "";
  const detail = useActionQuery(
    "get-handover-plan",
    { workspaceId: active, id },
    { enabled: Boolean(active && id) },
  );
  const risks = useActionQuery(
    "list-risk-findings",
    { workspaceId: active, personId },
    { enabled: Boolean(active && personId) },
  );
  const selected = (params.get("findingIds") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 30);
  function setSelected(next: string[]) {
    setParams((old) => {
      const value = new URLSearchParams(old);
      value.set("findingIds", next.join(","));
      value.set("personId", personId);
      return value;
    });
  }
  if (workspace.isLoading)
    return (
      <div className="p-8" aria-busy="true">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!active || !personId)
    return (
      <div className="p-8 space-y-3">
        <p role="alert">
          {actionErrorMessage(workspace.error) ??
            t("continuity.planDepartureNeeded")}
        </p>
        <Link className="underline" to="/workspace">
          {t("continuity.workspace")}
        </Link>
      </div>
    );
  const plan = detail.data;
  const existing = new Set(plan?.tasks.map((task) => task.findingId));
  const eligible =
    risks.data?.findings.filter(
      (f) =>
        !["rejected", "resolved"].includes(f.status) && !existing.has(f.id),
    ) ?? [];
  const selectedIds = selected.filter((id) =>
    eligible.some((f) => f.id === id),
  );
  const picker = (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium">{t("continuity.planChooseRisks")}</h2>
      {risks.isLoading && <Skeleton className="h-32 w-full" />}
      {risks.isError && (
        <p role="alert">
          {actionErrorMessage(risks.error) ?? t("continuity.loadFailed")}
        </p>
      )}
      {eligible.length === 0 && !risks.isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("continuity.planNoRisks")}
        </p>
      )}
      {eligible.map((f) => (
        <label
          key={f.id}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
        >
          <Checkbox
            className="mt-1"
            checked={selectedIds.includes(f.id)}
            disabled={!selectedIds.includes(f.id) && selectedIds.length >= 30}
            onCheckedChange={(checked) =>
              setSelected(
                checked
                  ? [...selected.filter((id) => id !== f.id), f.id]
                  : selected.filter((id) => id !== f.id),
              )
            }
          />
          <span className="min-w-0">
            <span className="block break-words text-sm font-medium">
              {f.title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(`continuity.risk_${f.severity}`)} ·{" "}
              {t(`continuity.risk_${f.status}`)}
            </span>
          </span>
        </label>
      ))}
      {risks.data?.hasMore && (
        <p className="text-xs text-muted-foreground">
          {t("continuity.riskMore")}
        </p>
      )}
      <Button
        disabled={!selectedIds.length}
        onClick={() =>
          sendToAgentChat({
            message: t("continuity.planDraftPrompt"),
            context: JSON.stringify({
              currentPage: "handover",
              activeWorkspaceId: active,
              selectedPersonId: personId,
              activeHandoverPlanId: plan?.id ?? null,
              selectedFindingIds: selectedIds,
            }),
            submit: true,
            openSidebar: true,
          })
        }
      >
        {t(plan ? "continuity.planAddDraft" : "continuity.planGenerate")}
      </Button>
      <Link
        className="inline-block text-sm underline"
        to={`/risks?workspaceId=${encodeURIComponent(active)}&personId=${encodeURIComponent(personId)}`}
      >
        {t("continuity.risks")}
      </Link>
    </section>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select
          value={personId}
          onValueChange={(v) => {
            setSelected([]);
            setParams({ workspaceId: active, personId: v });
          }}
        >
          <SelectTrigger
            className="w-64"
            aria-label={t("continuity.planDeparture")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspace
              .data!.people.filter((p) => p.departureDate)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Link
          className="text-sm underline"
          to={`/tasks?workspaceId=${encodeURIComponent(active)}`}
        >
          {t("continuity.tasks")}
        </Link>
      </div>
      {plans.isError && (
        <p role="alert">
          {actionErrorMessage(plans.error) ?? t("continuity.loadFailed")}
        </p>
      )}
      {id && detail.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : detail.isError ? (
        <p role="alert">
          {actionErrorMessage(detail.error) ?? t("continuity.loadFailed")}
        </p>
      ) : plan ? (
        <>
          <PlanReview key={`${plan.id}-${plan.revision}`} plan={plan} />
          {plan.status === "draft" && (
            <details>
              <summary className="cursor-pointer text-sm">
                {t("continuity.planAddRisks")}
              </summary>
              <div className="mt-4">{picker}</div>
            </details>
          )}
        </>
      ) : (
        picker
      )}
    </div>
  );
}
export function PlanReview({ plan }: { plan: Plan }) {
  const t = useT();
  const [notes, setNotes] = useState("");
  const review = useActionMutation("review-handover-plan");
  const remove = useActionMutation("remove-handover-plan-task");
  const pending = review.isPending || remove.isPending;
  const departure = new Date(plan.departureDate);
  const departureDay = `${departure.getFullYear()}-${String(departure.getMonth() + 1).padStart(2, "0")}-${String(departure.getDate()).padStart(2, "0")}`;
  const proposed = plan.tasks.filter(
    (task) => task.assignmentStatus === "suggested",
  );
  const ready =
    plan.tasks.length > 0 &&
    !plan.hasMore &&
    proposed.every((task) => task.assigneeId && task.dueDate);
  const decision = plan.status === "draft" ? "approve" : "reopen";
  return (
    <section className="rounded-xl border bg-card p-5 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t("continuity.planFor", { name: plan.personName })}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("continuity.mapDeparture", {
              date: new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
              }).format(new Date(plan.departureDate)),
            })}
          </p>
        </div>
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t(`continuity.plan_${plan.status}`)}
        </span>
      </header>
      <p className="text-sm text-muted-foreground">
        {t(
          plan.status === "draft"
            ? "continuity.planDraftCaution"
            : "continuity.planApprovedCaution",
        )}
      </p>
      {plan.tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("continuity.planEmpty")}
        </p>
      )}
      <div className="divide-y">
        {plan.tasks.map((task) => (
          <article key={task.id} className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-sm font-medium">
                  {task.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`continuity.risk_${task.priority}`)} ·{" "}
                  {t(
                    task.assignmentStatus === "suggested"
                      ? "continuity.planSuggested"
                      : "continuity.planConfirmed",
                  )}{" "}
                  · {t(`continuity.task_${task.status}`)}
                </p>
              </div>
              {task.assignmentStatus === "suggested" &&
                plan.status === "draft" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      remove.mutate(
                        {
                          workspaceId: plan.workspaceId,
                          id: task.id,
                          revision: task.revision,
                          reason: t("continuity.planRemovalReason"),
                        },
                        {
                          onSuccess: () =>
                            toast.success(t("continuity.planRemoved")),
                        },
                      )
                    }
                  >
                    {t("continuity.planRemove")}
                  </Button>
                )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                {task.assigneeName ?? t("continuity.planOwnerNeeded")}
              </span>
              <span>
                {task.dueDate
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(`${task.dueDate}T12:00:00`))
                  : t("continuity.planDateNeeded")}
              </span>
            </div>
            {task.dueDate && task.dueDate > departureDay && (
              <p className="text-xs text-destructive">
                {t("continuity.planAfterDeparture")}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-xs">
              <Link className="underline" to={task.urlPath}>
                {t("continuity.planEditTask")}
              </Link>
              {task.findingUrlPath && (
                <Link className="underline" to={task.findingUrlPath}>
                  {t("continuity.planViewRisk")}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {plan.hasMore && <p role="alert">{t("continuity.planTooMany")}</p>}
      {plan.reviewNotes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {plan.reviewNotes}
        </p>
      )}
      <div className="border-t pt-5 space-y-3">
        <label className="block space-y-2 text-sm">
          <span>{t("continuity.planReviewNote")}</span>
          <Textarea
            value={notes}
            maxLength={2000}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {plan.status === "draft" && !ready && (
          <p className="text-xs text-muted-foreground">
            {t("continuity.planApprovalNeeded")}
          </p>
        )}
        <Button
          disabled={
            pending || !notes.trim() || (decision === "approve" && !ready)
          }
          onClick={() =>
            review.mutate(
              {
                workspaceId: plan.workspaceId,
                id: plan.id,
                revision: plan.revision,
                decision,
                notes,
              },
              { onSuccess: () => toast.success(t("continuity.planReviewed")) },
            )
          }
        >
          {t(
            pending
              ? "continuity.verificationSaving"
              : decision === "approve"
                ? "continuity.planApprove"
                : "continuity.planReopen",
          )}
        </Button>
      </div>
      {(review.isError || remove.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {actionErrorMessage(review.error ?? remove.error) ??
            t("continuity.planSaveFailed")}
        </p>
      )}
    </section>
  );
}
