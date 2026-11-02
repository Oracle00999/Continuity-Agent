import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  IconArrowUpRight,
  IconCalendarEvent,
  IconDatabase,
  IconRefresh,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Continuity — Engineering handover" }];
}

export default function WorkspaceRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const selectedPersonId = params.get("personId") || undefined;
  const query = useActionQuery("get-workspace-context", {
    workspaceId,
    selectedPersonId,
  });
  const setup = useActionMutation("initialize-demo-workspace");
  const data = query.data;

  if (query.isLoading)
    return (
      <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-10" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (query.isError)
    return (
      <div className="mx-auto max-w-lg space-y-4 p-10" role="alert">
        <p>{actionErrorMessage(query.error) ?? t("continuity.loadFailed")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("continuity.retry")}
        </Button>
      </div>
    );
  if (!data?.workspace)
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-start justify-center gap-6 px-6 py-12">
        <IconShieldCheck className="size-10 text-primary" strokeWidth={1.5} />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("continuity.emptyTitle")}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          {t("continuity.emptyDescription")}
        </p>
        <Button disabled={setup.isPending} onClick={() => setup.mutate({})}>
          {setup.isPending
            ? t("continuity.preparing")
            : t("continuity.loadDemo")}
        </Button>
        {setup.isError && (
          <p role="alert" className="text-sm text-destructive">
            {actionErrorMessage(setup.error) ?? t("continuity.setupFailed")}
          </p>
        )}
      </div>
    );

  const selected = data.selectedPerson;
  const departing = data.people.find((person) => person.departureDate !== null);
  const daysLeft = departing?.departureDate
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(departing.departureDate) - Date.now()) / 86_400_000,
        ),
      )
    : null;

  function selectPerson(id: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("workspaceId", data!.workspace!.id);
      next.set("personId", id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("continuity.demo")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.workspace.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("continuity.records", {
              people: data.people.length,
              systems: data.systems.length,
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <IconRefresh
            className={cn("size-4", query.isFetching && "animate-spin")}
          />
          {query.isFetching
            ? t("continuity.refreshing")
            : t("continuity.refresh")}
        </Button>
      </header>

      {departing && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-3">
              <IconCalendarEvent className="size-5" />
            </div>
            <div>
              <p className="font-medium">{departing.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {departing.role}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {daysLeft
                ? t("continuity.daysRemaining", { count: daysLeft })
                : t("continuity.departed")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
              }).format(new Date(departing.departureDate!))}
            </p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <h2 className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-medium">
            <IconUsers className="size-4 text-muted-foreground" />
            {t("continuity.team")}
          </h2>
          <div className="divide-y divide-border">
            {data.people.map((person) => (
              <button
                key={person.id}
                onClick={() => selectPerson(person.id)}
                aria-pressed={selected?.id === person.id}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selected?.id === person.id && "bg-accent",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {person.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {person.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {person.role}
                  </span>
                </span>
                {person.departureDate && (
                  <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                    {t("continuity.departure")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <h2 className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-medium">
            <IconDatabase className="size-4 text-muted-foreground" />
            {t("continuity.systems")}
          </h2>
          <div className="divide-y divide-border">
            {data.systems.map((system) => (
              <div
                key={system.id}
                className="flex items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium">{system.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {system.description}
                  </p>
                </div>
                <span className="rounded bg-secondary px-2 py-1 text-xs">
                  {t(`continuity.${system.criticality}`)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">
          {selected ? selected.name : t("continuity.selectedPerson")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {selected ? selected.role : t("continuity.selectPerson")}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() =>
            sendToAgentChat({
              message: t("continuity.analystPrompt"),
              context: JSON.stringify({
                currentPage: "workspace",
                activeWorkspaceId: data.workspace!.id,
                selectedPersonId: selected?.id ?? null,
              }),
              submit: true,
              openSidebar: true,
            })
          }
        >
          {t("continuity.askAnalyst")}
          <IconArrowUpRight className="size-4" />
        </Button>
      </section>
      <div className="mt-6 flex items-start gap-3 px-1 text-muted-foreground">
        <IconShieldCheck className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm">{t("continuity.awaitingEvidence")}</p>
          <p className="mt-1 max-w-2xl text-xs leading-5">
            {t("continuity.evidenceDescription")}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Link
          className="text-sm underline underline-offset-4"
          to={`/documents?workspaceId=${encodeURIComponent(data.workspace.id)}`}
        >
          {t("continuity.documentsOpen")}
        </Link>
      </div>
    </div>
  );
}
