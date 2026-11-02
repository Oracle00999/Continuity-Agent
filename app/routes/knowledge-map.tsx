import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  IconUsers,
  IconDatabase,
  IconFileText,
  IconListCheck,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { knowledgeMapSchema } from "../../shared/knowledge-map";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
type MapData = z.infer<typeof knowledgeMapSchema>;
export function meta() {
  return [{ title: "Knowledge Map — Continuity" }];
}
export default function KnowledgeMapRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const active = workspace.data?.workspace?.id;
  const person =
    params.get("personId") ??
    workspace.data?.people.find((p) => p.departureDate)?.id ??
    "all";
  const nodeId = params.get("nodeId") || undefined;
  const confirmedOnly = params.get("confirmedOnly") === "true";
  const query = useActionQuery(
    "get-knowledge-map",
    {
      workspaceId: active,
      personId: person === "all" ? undefined : person,
      nodeId,
      confirmedOnly,
    },
    { enabled: Boolean(active) },
  );
  const [zoom, setZoom] = useState(1);
  function changeFilter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("workspaceId", active!);
      next.set(key, value);
      next.delete("nodeId");
      return next;
    });
  }
  function select(id: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("workspaceId", active!);
      next.set("personId", person);
      next.set("nodeId", id);
      return next;
    });
  }
  if (workspace.isLoading)
    return (
      <div className="p-8" aria-busy="true">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!active)
    return (
      <div className="p-8 space-y-3">
        <p role="alert">
          {actionErrorMessage(workspace.error) ??
            t("continuity.verificationWorkspace")}
        </p>
        <Link className="underline" to="/workspace">
          {t("continuity.workspace")}
        </Link>
      </div>
    );
  const data = query.data;
  return (
    <div className="space-y-5 p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={person}
            onValueChange={(value) => changeFilter("personId", value)}
          >
            <SelectTrigger
              aria-label={t("continuity.mapPerson")}
              className="w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("continuity.mapEveryone")}</SelectItem>
              {workspace.data!.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={confirmedOnly ? "secondary" : "outline"}
            aria-pressed={confirmedOnly}
            onClick={() =>
              changeFilter("confirmedOnly", String(!confirmedOnly))
            }
          >
            {t("continuity.mapConfirmedOnly")}
          </Button>
        </div>
        <Link
          to={`/documents?workspaceId=${encodeURIComponent(active)}`}
          className="text-sm underline"
        >
          {t("continuity.documents")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="w-7 border-t-2 border-primary" />
          {t("continuity.knowledge_confirmed")}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-7 border-t-2 border-dashed border-muted-foreground" />
          {t("continuity.knowledge_inferred")}
        </span>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-[36rem] w-full" />
      ) : query.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-6">
          <p>{actionErrorMessage(query.error) ?? t("continuity.loadFailed")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setParams({
                workspaceId: active,
                personId: person,
                confirmedOnly: String(confirmedOnly),
              });
              void query.refetch();
            }}
          >
            {t("continuity.mapResetSelection")}
          </Button>
        </div>
      ) : (
        data && (
          <>
            {data.hasMore && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("continuity.mapLimited")}
              </p>
            )}
            {data.claimCount === 0 ? (
              <div className="rounded-xl border bg-card p-8 space-y-4">
                <h1 className="text-lg font-medium">
                  {t("continuity.mapEmpty")}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  {t(
                    confirmedOnly
                      ? "continuity.mapNoConfirmed"
                      : "continuity.mapExtractFirst",
                  )}
                </p>
                <Link
                  to={`/documents?workspaceId=${encodeURIComponent(active)}`}
                  className="text-sm underline"
                >
                  {t("continuity.documentsOpen")}
                </Link>
              </div>
            ) : (
              <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {t("continuity.mapSelectNode")}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("continuity.mapZoomOut")}
                        disabled={zoom <= 0.5}
                        onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      >
                        −
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("continuity.mapResetZoom")}
                        onClick={() => setZoom(1)}
                      >
                        {Math.round(zoom * 100)}%
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("continuity.mapZoomIn")}
                        disabled={zoom >= 1.5}
                        onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <MapCanvas data={data} zoom={zoom} onSelect={select} />
                </section>
                <aside
                  className="min-w-0 rounded-xl border bg-card p-5 space-y-5"
                  aria-label={t("continuity.mapDetails")}
                >
                  {data.selectedNode ? (
                    <>
                      <header>
                        <p className="text-xs text-muted-foreground">
                          {t(`continuity.map_${data.selectedNode.kind}`)}
                        </p>
                        <h2 className="mt-1 break-words text-lg font-semibold">
                          {data.selectedNode.name}
                        </h2>
                        {data.selectedNode.description && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {data.selectedNode.description}
                          </p>
                        )}
                        {data.selectedNode.departureDate && (
                          <p className="mt-2 text-sm">
                            {t("continuity.mapDeparture", {
                              date: new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                              }).format(
                                new Date(data.selectedNode.departureDate),
                              ),
                            })}
                          </p>
                        )}
                      </header>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t("continuity.mapCaution")}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() =>
                          sendToAgentChat({
                            message: t("continuity.mapAnalystPrompt"),
                            context: JSON.stringify({
                              currentPage: "knowledge-map",
                              activeWorkspaceId: active,
                              selectedMapNodeId: data.selectedNode!.id,
                              selectedPersonId:
                                data.selectedNode!.kind === "person"
                                  ? data.selectedNode!.entityId
                                  : person === "all"
                                    ? null
                                    : person,
                            }),
                            submit: true,
                            openSidebar: true,
                          })
                        }
                      >
                        {t("continuity.askAnalyst")}
                      </Button>
                      {data.selectedClaims.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("continuity.mapNoConnections")}
                        </p>
                      )}
                      {data.selectedClaims.map((claim) => (
                        <article
                          key={claim.id}
                          className="border-t pt-4 space-y-3"
                        >
                          <h3 className="break-words text-sm font-medium">
                            {claim.personName}{" "}
                            {t(`continuity.knowledge_${claim.relationship}`)}{" "}
                            {claim.targetName}
                          </h3>
                          <span className="inline-block rounded bg-secondary px-2 py-1 text-xs">
                            {t(`continuity.knowledge_${claim.status}`)}
                          </span>
                          <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-3 text-sm leading-6">
                            {claim.quote}
                          </blockquote>
                          {claim.reviewNotes && (
                            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                              {claim.reviewNotes}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <Link className="underline" to={claim.urlPath}>
                              {claim.sourceName}
                            </Link>
                            <Link
                              className="underline"
                              to={`/documents?workspaceId=${encodeURIComponent(active)}&documentId=${encodeURIComponent(claim.documentId)}&panel=knowledge`}
                            >
                              {t("continuity.knowledgeReview")}
                            </Link>
                          </div>
                        </article>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("continuity.mapSelectNode")}
                    </p>
                  )}
                </aside>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
export function MapCanvas({
  data,
  zoom,
  onSelect,
}: {
  data: MapData;
  zoom: number;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const selected = data.selectedNode?.id;
  const groups = [
    data.nodes.filter((n) => n.kind === "person"),
    data.nodes.filter((n) => n.kind === "system" || n.kind === "process"),
    data.nodes.filter((n) => n.kind === "document"),
  ];
  const positions = new Map<string, { x: number; y: number }>();
  groups.forEach((group, col) =>
    group.forEach((node, row) =>
      positions.set(node.id, { x: 24 + col * 320, y: 60 + row * 112 }),
    ),
  );
  const width = 920;
  const height = Math.max(
    380,
    Math.max(...groups.map((g) => g.length)) * 112 + 80,
  );
  const relevant = new Set(data.selectedClaims.map((c) => c.id));
  const highlighted = new Set([selected]);
  data.edges
    .filter((e) => relevant.has(e.claimId))
    .forEach((e) => {
      highlighted.add(e.source);
      highlighted.add(e.target);
    });
  const icons = {
    person: IconUsers,
    system: IconDatabase,
    process: IconListCheck,
    document: IconFileText,
  };
  return (
    <div
      className="max-h-[38rem] overflow-auto"
      role="region"
      aria-label={t("continuity.mapCanvas")}
      tabIndex={0}
    >
      <div style={{ width: width * zoom, height: height * zoom }}>
        <div
          className="relative origin-top-left"
          style={{ width, height, transform: `scale(${zoom})` }}
        >
          {["mapPeople", "mapResponsibilities", "mapSources"].map(
            (label, i) => (
              <p
                key={label}
                className="absolute text-xs font-medium text-muted-foreground"
                style={{ left: 24 + i * 320, top: 20 }}
              >
                {t(`continuity.${label}`)}
              </p>
            ),
          )}
          <svg
            width={width}
            height={height}
            className="absolute inset-0 text-muted-foreground"
            aria-hidden="true"
          >
            {data.edges.map((edge) => {
              const a = positions.get(edge.source)!;
              const b = positions.get(edge.target)!;
              const x = a.x + 232;
              const y = a.y + 38;
              const end = b.x;
              const endY = b.y + 38;
              const active = !selected || relevant.has(edge.claimId);
              return (
                <path
                  key={edge.id}
                  d={`M ${x} ${y} C ${x + 44} ${y}, ${end - 44} ${endY}, ${end} ${endY}`}
                  fill="none"
                  stroke={
                    edge.status === "confirmed"
                      ? "hsl(var(--primary))"
                      : "currentColor"
                  }
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={
                    edge.status === "inferred" ? "5 5" : undefined
                  }
                  opacity={active ? 0.8 : 0.15}
                />
              );
            })}
          </svg>
          {data.nodes.map((node) => {
            const position = positions.get(node.id)!;
            const Icon = icons[node.kind];
            return (
              <button
                key={node.id}
                type="button"
                aria-pressed={selected === node.id}
                onClick={() => onSelect(node.id)}
                className={cn(
                  "absolute flex h-[76px] w-[232px] items-center gap-3 rounded-xl border bg-background px-4 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === node.id && "border-primary ring-2 ring-primary",
                  selected && !highlighted.has(node.id) && "opacity-40",
                )}
                style={{ left: position.x, top: position.y }}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-[10px] text-muted-foreground">
                    {t(`continuity.map_${node.kind}`)}
                  </span>
                  <span
                    className="line-clamp-2 break-words text-sm font-medium"
                    title={node.name}
                  >
                    {node.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
