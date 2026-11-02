import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  IconArrowUpRight,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import type { Overview } from "../../shared/overview";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export function meta() {
  return [{ title: "Overview — Continuity" }];
}
export default function OverviewRoute() {
  const t = useT();
  const [params] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const query = useActionQuery("get-overview", { workspaceId });
  const seed = useActionMutation("initialize-demo-workspace");
  if (query.isLoading)
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-10" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (query.isError)
    return (
      <div className="p-8 space-y-4" role="alert">
        <p>{actionErrorMessage(query.error) ?? t("continuity.loadFailed")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("continuity.retry")}
        </Button>
      </div>
    );
  if (!query.data?.workspace)
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-start justify-center gap-6 px-6 py-12">
        <IconShieldCheck className="size-10 text-primary" />
        <h1 className="text-3xl font-semibold">{t("continuity.emptyTitle")}</h1>
        <p className="text-base leading-7 text-muted-foreground">
          {t("continuity.emptyDescription")}
        </p>
        <Button disabled={seed.isPending} onClick={() => seed.mutate({})}>
          {t(seed.isPending ? "continuity.preparing" : "continuity.loadDemo")}
        </Button>
        {seed.isError && (
          <p role="alert">
            {actionErrorMessage(seed.error) ?? t("continuity.setupFailed")}
          </p>
        )}
      </div>
    );
  return (
    <OverviewDashboard
      data={query.data}
      refreshing={query.isFetching}
      onRefresh={() => void query.refetch()}
    />
  );
}
export function OverviewDashboard({
  data,
  refreshing = false,
  onRefresh,
}: {
  data: Overview;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const t = useT();
  const ws = encodeURIComponent(data.workspace!.id);
  const link = (path: string) => `${path}?workspaceId=${ws}`;
  const date = (value: string, withTime = false) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" as const } : {}),
    }).format(new Date(value));
  const metrics = [
    {
      label: "overviewCritical",
      value: data.metrics.criticalSystems,
      url: link("/workspace"),
    },
    {
      label: "overviewHighRisks",
      value: data.metrics.highPriorityRisks,
      url: `${link("/risks")}&personId=all`,
    },
    {
      label: "overviewAssignments",
      value: data.metrics.pendingAssignments,
      url: link("/tasks"),
    },
    {
      label: "overviewResults",
      value: data.metrics.runbooksWithResults,
      url: link("/verification"),
    },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.workspace!.name}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              sendToAgentChat({
                message: t("continuity.overviewAnalystPrompt"),
                context: JSON.stringify({
                  currentPage: "overview",
                  activeWorkspaceId: data.workspace!.id,
                }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            {t("continuity.askAnalyst")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
            aria-label={t("continuity.overviewRefresh")}
          >
            <IconRefresh
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
      </header>
      {data.departures.map((person) => {
        const remaining = Math.max(
          0,
          Math.ceil(
            (Date.parse(person.departureDate!) - Date.parse(data.asOf)) /
              86400000,
          ),
        );
        return (
          <section
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"
          >
            <div>
              <h2 className="font-medium">{person.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {person.role}
              </p>
              <p className="mt-2 text-sm">
                {t(
                  remaining
                    ? "continuity.daysRemaining"
                    : "continuity.departed",
                  { count: remaining },
                )}{" "}
                · {date(person.departureDate!)}
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 text-sm underline"
              to={`${link("/handover")}&personId=${encodeURIComponent(person.id)}`}
            >
              {t("continuity.overviewReviewPlan")}
              <IconArrowUpRight className="size-4" />
            </Link>
          </section>
        );
      })}
      {data.departures.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("continuity.overviewNoDepartures")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((item) => (
          <Link
            key={item.label}
            to={item.url}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent"
          >
            <p className="text-3xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(`continuity.${item.label}`)}
            </p>
          </Link>
        ))}
      </div>
      {data.metrics.suggestedTasks > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-secondary/40 px-5 py-4">
          <p className="text-sm">
            {t(
              data.metrics.suggestedTasks === 1
                ? "continuity.overviewSuggestionOne"
                : "continuity.overviewSuggestions",
              {
                count: data.metrics.suggestedTasks,
              },
            )}
          </p>
          <Link className="text-sm underline" to={link("/handover")}>
            {t("continuity.overviewReviewPlan")}
          </Link>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="text-sm font-medium">
              {t("continuity.overviewRisks")}
            </h2>
            <Link
              className="text-xs underline"
              to={`${link("/risks")}&personId=all`}
            >
              {t("continuity.overviewViewAll")}
            </Link>
          </div>
          <p className="px-5 pt-4 text-xs text-muted-foreground">
            {t("continuity.overviewRiskCounts", {
              open: data.metrics.openRisks,
              proposed: data.metrics.proposedRisks,
            })}
          </p>
          <div className="divide-y px-5">
            {data.topRisks.map((risk) => (
              <Link
                key={risk.id}
                to={risk.urlPath}
                className="block space-y-2 py-4"
              >
                <p className="break-words text-sm font-medium">{risk.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`continuity.risk_${risk.severity}`)} ·{" "}
                  {t(`continuity.risk_${risk.status}`)}
                  {risk.personName ? ` · ${risk.personName}` : ""}
                </p>
              </Link>
            ))}
            {data.topRisks.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                {t("continuity.overviewNoRisks")}
              </p>
            )}
          </div>
        </section>
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="text-sm font-medium">
              {t("continuity.overviewTasks")}
            </h2>
            <Link className="text-xs underline" to={link("/tasks")}>
              {t("continuity.overviewViewAll")}
            </Link>
          </div>
          <p className="px-5 pt-4 text-xs text-muted-foreground">
            {t("continuity.overviewOverdue", {
              count: data.metrics.overdueAssignments,
            })}
          </p>
          <div className="divide-y px-5">
            {data.upcomingTasks.map((task) => (
              <Link
                key={task.id}
                to={task.urlPath}
                className="block space-y-2 py-4"
              >
                <p className="break-words text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.assigneeName} · {t(`continuity.task_${task.status}`)}
                  {task.dueDate
                    ? ` · ${t("continuity.taskDue")} ${date(`${task.dueDate}T12:00:00+01:00`)}`
                    : ""}
                </p>
              </Link>
            ))}
            {data.upcomingTasks.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                {t("continuity.overviewNoTasks")}
              </p>
            )}
          </div>
        </section>
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="text-sm font-medium">
              {t("continuity.overviewTests")}
            </h2>
            <Link className="text-xs underline" to={link("/verification")}>
              {t("continuity.overviewViewAll")}
            </Link>
          </div>
          <div className="divide-y px-5">
            {data.latestTests.map((run) => (
              <Link
                key={run.id}
                to={run.urlPath}
                className="block space-y-2 py-4"
              >
                <p className="break-words text-sm font-medium">
                  {run.sourceName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {run.testerName} ·{" "}
                  {t(`continuity.verification_${run.status}`)} ·{" "}
                  {date(run.createdAt)}
                </p>
              </Link>
            ))}
            {data.latestTests.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                {t("continuity.overviewNoTests")}
              </p>
            )}
          </div>
          <p className="border-t p-5 text-xs leading-5 text-muted-foreground">
            {t("continuity.overviewTestCaution")}
          </p>
        </section>
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <h2 className="text-sm font-medium">
              {t("continuity.overviewOwnership")}
            </h2>
            <Link className="text-xs underline" to={link("/knowledge-map")}>
              {t("continuity.knowledgeMap")}
            </Link>
          </div>
          <div className="divide-y px-5">
            {data.ownershipCandidates.map((item, i) => (
              <Link
                key={`${item.kind}-${item.name}-${i}`}
                to={item.urlPath}
                className="block space-y-2 py-4"
              >
                <p className="break-words text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("continuity.overviewDocumentedOwner", {
                    name: item.personName,
                  })}
                </p>
              </Link>
            ))}
            {data.ownershipCandidates.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                {t("continuity.overviewNoOwnership")}
              </p>
            )}
          </div>
          <p className="border-t p-5 text-xs leading-5 text-muted-foreground">
            {t("continuity.overviewOwnershipCaution", {
              count: data.metrics.ownershipCandidates,
            })}
          </p>
        </section>
      </div>
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-5 text-sm font-medium">
          {t("continuity.overviewActivity")}
        </h2>
        <ol className="divide-y px-5">
          {data.activity.map((event) => (
            <li key={event.id}>
              <Link
                to={event.urlPath}
                className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t(`continuity.activity_${event.kind}`)}
                  </p>
                  {event.detail && (
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {event.detail}
                    </p>
                  )}
                </div>
                <time
                  dateTime={event.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {date(event.createdAt, true)}
                </time>
              </Link>
            </li>
          ))}
        </ol>
        {data.activity.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">
            {t("continuity.overviewNoActivity")}
          </p>
        )}
      </section>
    </div>
  );
}
