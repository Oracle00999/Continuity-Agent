import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { verificationSchema } from "../../shared/verification";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Run = z.infer<typeof verificationSchema>;
export default function VerificationRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const list = useActionQuery("list-verifications", { workspaceId });
  const docs = useActionQuery("list-documents", { workspaceId });
  const start = useActionMutation("start-procedure-verification");
  const [documentId, setDocument] = useState("");
  const [testerId, setTester] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const detail = useActionQuery(
    "get-verification",
    { workspaceId, id: params.get("runId") || "" },
    { enabled: Boolean(params.get("runId")) },
  );
  const selected = detail.data;
  if (workspace.isLoading || list.isLoading)
    return (
      <div className="p-8" aria-busy="true">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  if (!workspace.data?.workspace)
    return (
      <div className="p-8">
        <Link to="/workspace">{t("continuity.workspace")}</Link>
        <p role="alert">
          {actionErrorMessage(workspace.error) ??
            t("continuity.verificationWorkspace")}
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-10">
      <p className="text-sm text-muted-foreground">
        {t("continuity.verificationScope")}
      </p>
      {list.isError && (
        <p role="alert">
          {actionErrorMessage(list.error) ?? t("continuity.loadFailed")}{" "}
          <Button variant="outline" onClick={() => void list.refetch()}>
            {t("continuity.retry")}
          </Button>
        </p>
      )}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h1 className="text-lg font-semibold">
          {t("continuity.verificationStart")}
        </h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label id="runbook-label" className="text-sm">
              {t("continuity.verificationRunbook")}
            </label>
            <Select
              value={documentId}
              onValueChange={(v) => {
                setDocument(v);
                setRequestId(crypto.randomUUID());
              }}
            >
              <SelectTrigger aria-labelledby="runbook-label">
                <SelectValue
                  placeholder={t("continuity.verificationChooseRunbook")}
                />
              </SelectTrigger>
              <SelectContent>
                {docs.data?.documents
                  .filter((d) => d.status === "ready")
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.filename}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {docs.isError && (
              <p role="alert">
                {actionErrorMessage(docs.error) ?? t("continuity.loadFailed")}
              </p>
            )}
            {docs.data?.documents.length === 0 && (
              <Link className="text-sm underline" to="/documents">
                {t("continuity.documentsOpen")}
              </Link>
            )}
          </div>
          <div className="space-y-2">
            <label id="tester-label" className="text-sm">
              {t("continuity.verificationTester")}
            </label>
            <Select
              value={testerId}
              onValueChange={(v) => {
                setTester(v);
                setRequestId(crypto.randomUUID());
              }}
            >
              <SelectTrigger aria-labelledby="tester-label">
                <SelectValue
                  placeholder={t("continuity.verificationChooseTester")}
                />
              </SelectTrigger>
              <SelectContent>
                {workspace.data.people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          disabled={start.isPending || !documentId || !testerId}
          onClick={() =>
            start.mutate(
              {
                workspaceId: workspace.data!.workspace!.id,
                documentId,
                testerId,
                requestId,
              },
              {
                onSuccess: (data) => {
                  setParams({
                    workspaceId: data.run.workspaceId,
                    runId: data.run.id,
                  });
                  setRequestId(crypto.randomUUID());
                },
              },
            )
          }
        >
          {t(
            start.isPending
              ? "continuity.verificationStarting"
              : "continuity.verificationStart",
          )}
        </Button>
        {start.isError && (
          <p role="alert" className="text-sm text-destructive">
            {actionErrorMessage(start.error) ??
              t("continuity.verificationSaveFailed")}
          </p>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav
          aria-label={t("continuity.verificationHistory")}
          className="space-y-2"
        >
          {list.data?.runs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("continuity.verificationEmpty")}
            </p>
          )}
          {list.data?.runs.map((run) => (
            <Link
              key={run.id}
              to={run.urlPath}
              aria-current={run.id === selected?.id ? "page" : undefined}
              className={`block rounded-lg border p-4 text-sm ${run.id === selected?.id ? "bg-accent" : "bg-card"}`}
            >
              <span className="block font-medium break-words">
                {run.sourceName}
              </span>
              <span className="mt-2 block text-muted-foreground">
                {run.testerName} · {t(`continuity.verification_${run.status}`)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                }).format(new Date(run.createdAt))}
              </span>
            </Link>
          ))}
          {list.data?.hasMore && (
            <p className="text-sm text-muted-foreground">
              {t("continuity.verificationMore")}
            </p>
          )}
        </nav>
        {detail.isError ? (
          <p role="alert">
            {actionErrorMessage(detail.error) ?? t("continuity.loadFailed")}
          </p>
        ) : detail.isLoading && params.get("runId") ? (
          <Skeleton className="h-72 w-full" />
        ) : selected ? (
          <RunEditor
            key={`${selected.id}-${selected.revision}`}
            run={selected}
          />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            {t("continuity.verificationSelect")}
          </p>
        )}
      </div>
    </div>
  );
}
function RunEditor({ run }: { run: Run }) {
  const t = useT();
  const [steps, setSteps] = useState(run.steps);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<
    "passed" | "passed_with_gaps" | "failed"
  >("failed");
  const save = useActionMutation("record-verification-steps");
  const finalize = useActionMutation("finalize-verification");
  const open = run.status === "open";
  const pending = save.isPending || finalize.isPending;
  const changes = steps.filter((s) => {
    const old = run.steps.find((o) => o.number === s.number)!;
    return (
      s.result !== "pending" &&
      (s.result !== old.result || s.notes !== old.notes)
    );
  });
  const canFinalize =
    run.steps.every((s) => s.result !== "pending") && !changes.length;
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 space-y-5">
      <header>
        <h2 className="font-semibold break-words">{run.sourceName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {run.testerName} · {t(`continuity.verification_${run.status}`)}
        </p>
        <Link
          className="mt-2 inline-block text-sm underline"
          to={`/documents?workspaceId=${encodeURIComponent(run.workspaceId)}&documentId=${encodeURIComponent(run.documentId)}`}
        >
          {t("continuity.documentsViewSource")}
        </Link>
      </header>
      {steps.map((step, i) => (
        <div key={step.number} className="space-y-3 border-t pt-4">
          <p className="whitespace-pre-wrap text-sm leading-6">
            {step.instruction}
          </p>
          {(run.steps[i]?.result === "blocked" ||
            run.steps[i]?.result === "unclear") && (
            <Link
              className="inline-block text-sm underline"
              to={`/tasks?workspaceId=${encodeURIComponent(run.workspaceId)}&runId=${encodeURIComponent(run.id)}&stepNumber=${step.number}`}
            >
              {t("continuity.taskFromStep")}
            </Link>
          )}
          {open ? (
            <>
              <Select
                disabled={pending}
                value={step.result}
                onValueChange={(value) =>
                  setSteps((old) =>
                    old.map((s, n) =>
                      n === i
                        ? { ...s, result: value as typeof step.result }
                        : s,
                    ),
                  )
                }
              >
                <SelectTrigger
                  aria-label={t("continuity.verificationResultFor", {
                    number: step.number,
                  })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["pending", "completed", "blocked", "unclear"].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {t(`continuity.verification_${value}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Textarea
                disabled={pending}
                maxLength={4000}
                aria-label={t("continuity.verificationNotesFor", {
                  number: step.number,
                })}
                placeholder={t("continuity.verificationNotes")}
                value={step.notes}
                onChange={(e) =>
                  setSteps((old) =>
                    old.map((s, n) =>
                      n === i ? { ...s, notes: e.target.value } : s,
                    ),
                  )
                }
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {t(`continuity.verification_${step.result}`)}
              </p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {step.notes}
              </p>
            </>
          )}
        </div>
      ))}
      {open ? (
        <>
          <Button
            disabled={
              pending || !changes.length || changes.some((s) => !s.notes.trim())
            }
            onClick={() =>
              save.mutate({
                workspaceId: run.workspaceId,
                id: run.id,
                revision: run.revision,
                results: changes.map((s) => ({
                  number: s.number,
                  result: s.result as "completed" | "blocked" | "unclear",
                  notes: s.notes,
                })),
              })
            }
          >
            {t(
              save.isPending
                ? "continuity.verificationSaving"
                : "continuity.verificationSave",
            )}
          </Button>
          <div className="border-t pt-5 space-y-3">
            <h3 className="font-medium text-sm">
              {t("continuity.verificationFinish")}
            </h3>
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as typeof outcome)}
              disabled={pending}
            >
              <SelectTrigger aria-label={t("continuity.verificationOutcome")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["passed", "passed_with_gaps", "failed"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`continuity.verification_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              disabled={pending}
              value={summary}
              maxLength={4000}
              onChange={(e) => setSummary(e.target.value)}
              aria-label={t("continuity.verificationSummary")}
              placeholder={t("continuity.verificationSummary")}
            />
            <p className="text-xs text-muted-foreground">
              {t("continuity.verificationAttestation")}
            </p>
            <Button
              variant="outline"
              disabled={pending || !canFinalize || !summary.trim()}
              onClick={() =>
                finalize.mutate({
                  workspaceId: run.workspaceId,
                  id: run.id,
                  revision: run.revision,
                  outcome,
                  summary,
                })
              }
            >
              {t(
                finalize.isPending
                  ? "continuity.verificationSaving"
                  : "continuity.verificationFinish",
              )}
            </Button>
          </div>
        </>
      ) : (
        <p className="border-t pt-4 whitespace-pre-wrap text-sm">
          {run.summary}
        </p>
      )}
      {(save.isError || finalize.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {actionErrorMessage(save.error ?? finalize.error) ??
            t("continuity.verificationSaveFailed")}
        </p>
      )}
    </section>
  );
}
