import { DocumentKnowledge } from "@/components/continuity/document-knowledge";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconFileText,
  IconUpload,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DocumentUploadError,
  stageDocumentUpload,
} from "@/lib/document-upload";
import { cn } from "@/lib/utils";

import { MAX_DOCUMENT_BYTES } from "../../shared/documents";

export function meta() {
  return [{ title: "Documents — Continuity" }];
}

export default function DocumentsRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const documentId = params.get("documentId") || "";
  const evidenceId = params.get("evidenceId");
  const panel = params.get("panel");
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const activeId = workspace.data?.workspace?.id;
  const listing = useActionQuery(
    "list-documents",
    { workspaceId: activeId },
    { enabled: Boolean(activeId) },
  );
  const detail = useActionQuery(
    "get-document",
    { workspaceId: activeId, id: documentId },
    { enabled: Boolean(activeId && documentId) },
  );
  const loadDemo = useActionMutation("load-demo-documents");
  const ingest = useActionMutation("ingest-document");
  const [stage, setStage] = useState<"uploading" | "processing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"evidence" | "text" | "knowledge">(
    params.get("panel") === "knowledge"
      ? "knowledge"
      : params.get("panel") === "text"
        ? "text"
        : "evidence",
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = stage !== null || loadDemo.isPending || ingest.isPending;
  const current = detail.data;

  useEffect(() => {
    setTab(
      evidenceId
        ? "evidence"
        : panel === "knowledge"
          ? "knowledge"
          : panel === "text"
            ? "text"
            : "evidence",
    );
  }, [panel, evidenceId, documentId]);

  useEffect(() => {
    if (!current || !evidenceId) return;
    setTab("evidence");
    document
      .getElementById(`evidence-${evidenceId}`)
      ?.scrollIntoView({ block: "center" });
  }, [current, evidenceId]);

  function selectPanel(panel: "evidence" | "text" | "knowledge") {
    setTab(panel);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("panel", panel);
      next.delete("evidenceId");
      return next;
    });
  }

  function selectDocument(id: string) {
    setTab("evidence");
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (activeId) next.set("workspaceId", activeId);
      next.set("documentId", id);
      next.delete("evidenceId");
      next.delete("panel");
      return next;
    });
  }

  async function upload(file: File) {
    if (!activeId || busy) return;
    setError(null);
    setNotice(null);
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(t("continuity.documentsTooLarge"));
      return;
    }
    setStage("uploading");
    try {
      const staged = await stageDocumentUpload(file, activeId);
      setStage("processing");
      const result = await ingest.mutateAsync({
        workspaceId: activeId,
        attachmentRef: staged.attachmentRef,
      });
      selectDocument(result.document.id);
      setNotice(
        t(
          result.duplicate
            ? "continuity.documentsDuplicate"
            : "continuity.documentsSaved",
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof DocumentUploadError
          ? failure.message
          : (actionErrorMessage(failure) ??
              t("continuity.documentsUploadFailed")),
      );
    } finally {
      setStage(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function addDemo() {
    if (!activeId || busy) return;
    setError(null);
    setNotice(null);
    try {
      const result = await loadDemo.mutateAsync({ workspaceId: activeId });
      const restore = result.documents.find(
        (item) => item.filename === "Database Backup & Restore.md",
      );
      if (restore) selectDocument(restore.id);
      setNotice(
        t(
          result.insertedCount
            ? "continuity.documentsDemoSaved"
            : "continuity.documentsDemoExists",
        ),
      );
    } catch (failure) {
      setError(
        actionErrorMessage(failure) ?? t("continuity.documentsUploadFailed"),
      );
    }
  }

  if (workspace.isLoading)
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (workspace.isError)
    return (
      <div className="space-y-4 p-8" role="alert">
        <p>
          {actionErrorMessage(workspace.error) ?? t("continuity.loadFailed")}
        </p>
        <Button onClick={() => void workspace.refetch()}>
          {t("continuity.retry")}
        </Button>
      </div>
    );
  if (!activeId)
    return (
      <div className="space-y-4 p-8">
        <p>{t("continuity.documentsNeedWorkspace")}</p>
        <Link to="/workspace" className="underline underline-offset-4">
          {t("continuity.workspace")}
        </Link>
      </div>
    );

  const mentions = current
    ? [
        ...new Map(
          current.evidence
            .flatMap((passage) => passage.mentions)
            .map((mention) => [mention.id, mention]),
        ).values(),
      ]
    : [];
  const substantivePassages =
    current?.evidence.filter(
      (passage) =>
        passage.id === evidenceId || !/^#{1,6}\s+[^\n]+$/.test(passage.quote),
    ) ?? [];
  const visiblePassages = substantivePassages.length
    ? substantivePassages
    : (current?.evidence ?? []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconFileText className="size-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">
            {workspace.data?.workspace?.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void addDemo()}
          >
            {loadDemo.isPending
              ? t("continuity.documentsPreparingDemo")
              : t("continuity.documentsLoadDemo")}
          </Button>
          <Button disabled={busy} onClick={() => fileInput.current?.click()}>
            <IconUpload className="size-4" />
            {stage
              ? t(
                  stage === "uploading"
                    ? "continuity.documentsUploading"
                    : "continuity.documentsProcessing",
                )
              : t("continuity.documentsUpload")}
          </Button>
          <Input
            ref={fileInput}
            type="file"
            accept=".pdf,.md,.markdown,.txt"
            className="sr-only"
            disabled={busy}
            aria-label={t("continuity.documentsChooseFile")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
      </header>
      <p className="mb-5 text-xs text-muted-foreground">
        {t("continuity.documentsFormats")}
      </p>
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <IconCheck className="size-4" />
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className="overflow-hidden rounded-xl border border-border bg-card"
          aria-label={t("continuity.documents")}
        >
          {listing.isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : listing.isError ? (
            <div className="space-y-3 p-4" role="alert">
              <p className="text-sm">
                {actionErrorMessage(listing.error) ??
                  t("continuity.loadFailed")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void listing.refetch()}
              >
                {t("continuity.retry")}
              </Button>
            </div>
          ) : listing.data?.documents.length ? (
            <div className="divide-y divide-border">
              {listing.data.documents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectDocument(item.id)}
                  aria-current={item.id === documentId ? "true" : undefined}
                  className={cn(
                    "block w-full px-4 py-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    item.id === documentId && "bg-accent",
                  )}
                >
                  <span className="block text-sm font-medium leading-6">
                    {item.filename}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {t(
                      item.status === "needs_text"
                        ? "continuity.documentsNeedsText"
                        : "continuity.documentsExtracted",
                    )}
                  </span>
                </button>
              ))}
              {listing.data.hasMore && (
                <p className="p-4 text-xs text-muted-foreground">
                  {t("continuity.documentsFirstHundred")}
                </p>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm leading-6 text-muted-foreground">
              {t("continuity.documentsEmpty")}
            </div>
          )}
        </aside>

        <section className="min-w-0 rounded-xl border border-border bg-card">
          {!documentId ? (
            <div className="flex min-h-96 flex-col items-start justify-center gap-4 px-6 py-10">
              <IconFileText className="size-8 text-muted-foreground" />
              <h2 className="text-xl font-medium">
                {t("continuity.documentsSelectTitle")}
              </h2>
              <p className="max-w-lg text-sm leading-7 text-muted-foreground">
                {t("continuity.documentsSelectDescription")}
              </p>
            </div>
          ) : detail.isLoading ? (
            <div className="space-y-5 p-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          ) : detail.isError ? (
            <div role="alert" className="space-y-3 p-6">
              <p>
                {actionErrorMessage(detail.error) ?? t("continuity.loadFailed")}
              </p>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                {t("continuity.retry")}
              </Button>
            </div>
          ) : (
            current && (
              <>
                <div className="border-b border-border p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <h2 className="max-w-xl break-words text-lg font-semibold">
                      {current.filename}
                    </h2>
                    <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                      {t(
                        current.source === "demo"
                          ? "continuity.documentsDemo"
                          : "continuity.documentsUploaded",
                      )}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("continuity.documentsAdded")}{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(current.uploadedAt))}
                  </p>
                  {current.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="mt-4 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm leading-6"
                    >
                      <IconAlertTriangle className="mt-1 size-4 shrink-0" />
                      <p>{warning}</p>
                    </div>
                  ))}
                  <Button
                    className="mt-4"
                    size="sm"
                    variant="outline"
                    disabled={current.status === "needs_text"}
                    onClick={() =>
                      sendToAgentChat({
                        message: t("continuity.documentsAnalystPrompt"),
                        context: JSON.stringify({
                          currentPage: "documents",
                          activeWorkspaceId: activeId,
                          selectedDocumentId: current.id,
                        }),
                        submit: true,
                        openSidebar: true,
                      })
                    }
                  >
                    {t("continuity.documentsAskAnalyst")}
                    <IconArrowUpRight className="size-4" />
                  </Button>
                  {mentions.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t("continuity.documentsMentions")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mentions.map((mention) => (
                          <span
                            key={mention.id}
                            className="rounded-md bg-secondary px-2 py-1 text-xs"
                          >
                            {mention.name}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("continuity.documentsMentionsCaution")}
                      </p>
                    </div>
                  )}
                </div>
                <div
                  className="flex gap-2 border-b border-border px-5 py-3"
                  role="group"
                  aria-label={t("continuity.documentsSourceView")}
                >
                  <Button
                    id="passages-tab"
                    aria-pressed={tab === "evidence"}
                    aria-controls="document-source-panel"
                    variant={tab === "evidence" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => selectPanel("evidence")}
                  >
                    {t("continuity.documentsPassages")}
                  </Button>
                  <Button
                    id="text-tab"
                    aria-pressed={tab === "text"}
                    aria-controls="document-source-panel"
                    variant={tab === "text" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => selectPanel("text")}
                  >
                    {t("continuity.documentsText")}
                  </Button>
                  <Button
                    id="knowledge-tab"
                    aria-pressed={tab === "knowledge"}
                    aria-controls="document-source-panel"
                    variant={tab === "knowledge" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => selectPanel("knowledge")}
                  >
                    {t("continuity.knowledge")}
                  </Button>
                </div>
                <div
                  id="document-source-panel"
                  role="region"
                  aria-labelledby={
                    tab === "knowledge"
                      ? "knowledge-tab"
                      : tab === "evidence"
                        ? "passages-tab"
                        : "text-tab"
                  }
                  className="p-5 sm:p-6"
                >
                  {tab === "knowledge" ? (
                    <DocumentKnowledge
                      workspaceId={current.workspaceId}
                      documentId={current.id}
                      readable={current.status === "ready"}
                    />
                  ) : tab === "text" ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-7">
                      {current.extractedText ||
                        t("continuity.documentsNeedsText")}
                    </pre>
                  ) : current.evidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("continuity.documentsNeedsText")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {visiblePassages.map((passage) => (
                        <article
                          key={passage.id}
                          id={`evidence-${passage.id}`}
                          className={cn(
                            "scroll-mt-6 rounded-lg border border-border p-4",
                            evidenceId === passage.id && "ring-2 ring-ring",
                          )}
                        >
                          <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {passage.section ??
                                t("continuity.documentsSourcePassage")}
                              {passage.pageNumber !== null
                                ? ` · ${t("continuity.documentsPage", { number: passage.pageNumber })}`
                                : ""}
                            </span>
                          </div>
                          <blockquote className="whitespace-pre-wrap break-words text-sm leading-7">
                            {passage.quote}
                          </blockquote>
                          <Link
                            to={`${current.urlPath}&evidenceId=${encodeURIComponent(passage.id)}`}
                            className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4"
                          >
                            {t("continuity.documentsViewSource")}
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </section>
      </div>
    </div>
  );
}
