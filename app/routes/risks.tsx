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
import { riskSchema } from "../../shared/risks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function meta() {
  return [{ title: "Risk Register — Continuity" }];
}
type Risk = z.infer<typeof riskSchema>;
export default function RisksRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const active = workspace.data?.workspace?.id;
  const person =
    params.get("personId") ??
    workspace.data?.people.find((p) => p.departureDate)?.id ??
    "all";
  const rawStatus = params.get("status") || "all";
  const status = (
    ["proposed", "accepted", "rejected", "resolved"].includes(rawStatus)
      ? rawStatus
      : "all"
  ) as Risk["status"] | "all";
  const id = params.get("findingId") || "";
  const list = useActionQuery(
    "list-risk-findings",
    {
      workspaceId: active,
      personId: person === "all" ? undefined : person,
      status: status === "all" ? undefined : status,
    },
    { enabled: Boolean(active) },
  );
  const detail = useActionQuery(
    "get-risk-finding",
    { workspaceId: active, id },
    { enabled: Boolean(active && id) },
  );
  function filter(key: string, value: string) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set("workspaceId", active!);
      next.set("personId", person);
      next.set(key, value);
      next.delete("findingId");
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
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Select value={person} onValueChange={(v) => filter("personId", v)}>
            <SelectTrigger
              className="w-52"
              aria-label={t("continuity.mapPerson")}
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
          <Select value={status} onValueChange={(v) => filter("status", v)}>
            <SelectTrigger
              className="w-44"
              aria-label={t("continuity.riskStatus")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("continuity.riskAll")}</SelectItem>
              {["proposed", "accepted", "rejected", "resolved"].map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`continuity.risk_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() =>
            sendToAgentChat({
              message: t("continuity.riskAssessPrompt"),
              context: JSON.stringify({
                currentPage: "risks",
                activeWorkspaceId: active,
                selectedPersonId: person === "all" ? null : person,
              }),
              submit: true,
              openSidebar: true,
            })
          }
        >
          {t("continuity.riskAssess")}
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {t("continuity.riskCaution")}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
        <nav aria-label={t("continuity.risks")} className="space-y-2">
          {list.isLoading && <Skeleton className="h-64 w-full" />}
          {list.isError && (
            <div role="alert">
              <p>
                {actionErrorMessage(list.error) ?? t("continuity.loadFailed")}
              </p>
              <Button variant="outline" onClick={() => void list.refetch()}>
                {t("continuity.retry")}
              </Button>
            </div>
          )}
          {list.data?.findings.length === 0 && (
            <div className="rounded-xl border p-5">
              <p className="text-sm text-muted-foreground">
                {t("continuity.riskEmpty")}
              </p>
            </div>
          )}
          {list.data?.findings.map((f) => (
            <Link
              key={f.id}
              to={`${f.urlPath}&personId=${encodeURIComponent(person)}&status=${status}`}
              aria-current={f.id === id ? "page" : undefined}
              className={`block rounded-lg border p-4 ${f.id === id ? "bg-accent" : "bg-card"}`}
            >
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={
                    f.severity === "critical" || f.severity === "high"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {t(`continuity.risk_${f.severity}`)}
                </span>
                <span className="text-muted-foreground">
                  {t(`continuity.risk_${f.status}`)}
                </span>
              </div>
              <p className="mt-2 break-words text-sm font-medium">{f.title}</p>
              {(f.personName || f.systemName) && (
                <p className="mt-2 break-words text-xs text-muted-foreground">
                  {[f.personName, f.systemName].filter(Boolean).join(" · ")}
                </p>
              )}
            </Link>
          ))}
          {list.data?.hasMore && (
            <p className="text-xs text-muted-foreground">
              {t("continuity.riskMore")}
            </p>
          )}
        </nav>
        {id && detail.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : detail.isError ? (
          <div role="alert">
            <p>
              {actionErrorMessage(detail.error) ?? t("continuity.loadFailed")}
            </p>
            <Button variant="outline" onClick={() => void detail.refetch()}>
              {t("continuity.retry")}
            </Button>
          </div>
        ) : detail.data ? (
          <RiskDetail
            key={`${detail.data.id}-${detail.data.revision}`}
            risk={detail.data}
          />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            {t("continuity.riskSelect")}
          </p>
        )}
      </div>
    </div>
  );
}
export function RiskDetail({ risk }: { risk: Risk }) {
  const t = useT();
  const update = useActionMutation("update-risk-finding");
  const [title, setTitle] = useState(risk.title);
  const [description, setDescription] = useState(risk.description);
  const [severity, setSeverity] = useState(risk.severity);
  const [severityReason, setReason] = useState(risk.severityReason);
  const [uncertainty, setUncertainty] = useState(risk.uncertainty);
  const [recommendedAction, setAction] = useState(risk.recommendedAction);
  const [confidence, setConfidence] = useState(String(risk.confidence * 100));
  const [status, setStatus] = useState(risk.status);
  const [notes, setNotes] = useState(risk.reviewNotes);
  const valid =
    title.trim() &&
    description.trim().length >= 20 &&
    severityReason.trim().length >= 10 &&
    uncertainty.trim().length >= 10 &&
    recommendedAction.trim().length >= 10 &&
    confidence !== "" &&
    Number(confidence) >= 0 &&
    Number(confidence) <= 100 &&
    notes.trim();
  const fields = [
    {
      label: "riskDescription",
      value: description,
      set: setDescription,
      max: 2000,
    },
    {
      label: "riskSeverityReason",
      value: severityReason,
      set: setReason,
      max: 1000,
    },
    {
      label: "riskUncertainty",
      value: uncertainty,
      set: setUncertainty,
      max: 1500,
    },
    {
      label: "riskRecommendation",
      value: recommendedAction,
      set: setAction,
      max: 1500,
    },
  ];
  return (
    <article className="min-w-0 rounded-xl border bg-card p-5 space-y-6">
      <header>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{t(`continuity.risk_${risk.type}`)}</span>
          <span>{t(`continuity.risk_${risk.status}`)}</span>
          <span>{t(`continuity.risk_${risk.severity}`)}</span>
        </div>
        <h1 className="mt-3 break-words text-xl font-semibold">{risk.title}</h1>
        {(risk.personName || risk.systemName || risk.processName) && (
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {[risk.personName, risk.systemName, risk.processName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
          {risk.description}
        </p>
      </header>
      {[
        { label: "riskSeverityReason", value: risk.severityReason },
        { label: "riskUncertainty", value: risk.uncertainty },
        { label: "riskRecommendation", value: risk.recommendedAction },
      ].map((item) => (
        <section key={item.label}>
          <h2 className="text-sm font-medium">
            {t(`continuity.${item.label}`)}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {item.value}
          </p>
        </section>
      ))}
      <section className="space-y-4 border-t pt-5">
        <h2 className="text-sm font-medium">{t("continuity.riskSources")}</h2>
        {risk.evidence.map((e) => (
          <div key={e.evidenceId}>
            <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-3 text-sm leading-7">
              {e.quote}
            </blockquote>
            <Link
              to={e.urlPath}
              className="mt-2 inline-block text-xs underline"
            >
              {e.sourceName}
            </Link>
          </div>
        ))}
      </section>
      {risk.verificationSnapshot && (
        <section className="space-y-3 border-t pt-5">
          <h2 className="text-sm font-medium">
            {t("continuity.riskTestSnapshot")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {risk.verificationSnapshot.testerName} ·{" "}
            {t(`continuity.verification_${risk.verificationSnapshot.status}`)}
          </p>
          {risk.verificationSnapshot.steps.map((step) => (
            <div key={step.number} className="space-y-1 text-sm">
              <p>{step.instruction}</p>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {step.notes}
              </p>
            </div>
          ))}
          {risk.verificationSnapshot.summary && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {risk.verificationSnapshot.summary}
            </p>
          )}
          <Link
            className="inline-block text-xs underline"
            to={risk.verificationSnapshot.urlPath}
          >
            {t("continuity.taskViewTest")}
          </Link>
        </section>
      )}
      {risk.personId && !["rejected", "resolved"].includes(risk.status) && (
        <Link
          className="inline-block text-sm underline"
          to={`/handover?workspaceId=${encodeURIComponent(risk.workspaceId)}&personId=${encodeURIComponent(risk.personId)}&findingIds=${encodeURIComponent(risk.id)}`}
        >
          {t("continuity.planAddressRisk")}
        </Link>
      )}
      {risk.reviewNotes && (
        <section className="border-t pt-5">
          <h2 className="text-sm font-medium">
            {t("continuity.riskLastReview")}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {risk.reviewNotes}
          </p>
        </section>
      )}
      <details className="border-t pt-5">
        <summary className="cursor-pointer text-sm font-medium">
          {t("continuity.knowledgeReview")}
        </summary>
        <div className="mt-4 space-y-4">
          <details>
            <summary className="cursor-pointer text-sm">
              {t("continuity.riskEdit")}
            </summary>
            <div className="mt-4 space-y-4">
              <label className="block space-y-2 text-sm">
                <span>{t("continuity.riskTitle")}</span>
                <Input
                  disabled={update.isPending}
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              {fields.map((field) => (
                <label key={field.label} className="block space-y-2 text-sm">
                  <span>{t(`continuity.${field.label}`)}</span>
                  <Textarea
                    disabled={update.isPending}
                    value={field.value}
                    maxLength={field.max}
                    onChange={(e) => field.set(e.target.value)}
                  />
                </label>
              ))}
              <Select
                disabled={update.isPending}
                value={severity}
                onValueChange={(v) => setSeverity(v as typeof severity)}
              >
                <SelectTrigger aria-label={t("continuity.riskSeverity")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["critical", "high", "medium", "low"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`continuity.risk_${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="block space-y-2 text-sm">
                <span>{t("continuity.riskConfidence")}</span>
                <Input
                  disabled={update.isPending}
                  type="number"
                  min={0}
                  max={100}
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                />
              </label>
            </div>
          </details>
          <Select
            disabled={update.isPending}
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
          >
            <SelectTrigger aria-label={t("continuity.riskStatus")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["proposed", "accepted", "rejected", "resolved"].map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`continuity.risk_${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="block space-y-2 text-sm">
            <span>{t("continuity.riskReviewNote")}</span>
            <Textarea
              disabled={update.isPending}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("continuity.riskResolveCaution")}
          </p>
          <Button
            disabled={update.isPending || !valid}
            onClick={() =>
              update.mutate(
                {
                  workspaceId: risk.workspaceId,
                  id: risk.id,
                  revision: risk.revision,
                  title,
                  description,
                  severity,
                  severityReason,
                  confidence: Number(confidence) / 100,
                  uncertainty,
                  recommendedAction,
                  status,
                  reviewNotes: notes,
                },
                { onSuccess: () => toast.success(t("continuity.riskSaved")) },
              )
            }
          >
            {t(
              update.isPending
                ? "continuity.verificationSaving"
                : "continuity.riskSave",
            )}
          </Button>
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {actionErrorMessage(update.error) ??
                t("continuity.riskSaveFailed")}
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
