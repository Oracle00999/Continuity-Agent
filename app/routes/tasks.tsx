import { toast } from "sonner";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { useState, useId } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { taskSchema } from "../../shared/handover-tasks";
import { verificationSchema } from "../../shared/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
type Person = { id: string; name: string };
type Task = z.infer<typeof taskSchema>;
export default function TasksRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get("workspaceId") || undefined;
  const workspace = useActionQuery("get-workspace-context", { workspaceId });
  const active = workspace.data?.workspace?.id;
  const list = useActionQuery(
    "list-handover-tasks",
    { workspaceId: active },
    { enabled: Boolean(active) },
  );
  const runs = useActionQuery(
    "list-verifications",
    { workspaceId: active },
    { enabled: Boolean(active) },
  );
  const runId = params.get("runId") || "";
  const taskId = params.get("taskId") || "";
  const run = useActionQuery(
    "get-verification",
    { workspaceId: active, id: runId },
    { enabled: Boolean(active && runId) },
  );
  const detail = useActionQuery(
    "get-handover-task",
    { workspaceId: active, id: taskId },
    { enabled: Boolean(active && taskId) },
  );
  if (workspace.isLoading)
    return (
      <div className="p-8" aria-busy="true">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  if (!active)
    return (
      <div className="p-8 space-y-3">
        <p role="alert">
          {actionErrorMessage(workspace.error) ??
            t("continuity.verificationWorkspace")}
        </p>
        <Link to="/workspace" className="underline">
          {t("continuity.workspace")}
        </Link>
      </div>
    );
  const people = workspace.data!.people;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-10">
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h1 className="text-lg font-semibold">{t("continuity.taskCreate")}</h1>
        <Select
          value={runId}
          onValueChange={(value) =>
            setParams({ workspaceId: active, runId: value })
          }
        >
          <SelectTrigger aria-label={t("continuity.taskChooseTest")}>
            <SelectValue placeholder={t("continuity.taskChooseTest")} />
          </SelectTrigger>
          <SelectContent>
            {runs.data?.runs.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.sourceName} · {r.testerName} ·{" "}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(r.createdAt))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {runs.isError && (
          <p role="alert">
            {actionErrorMessage(runs.error) ?? t("continuity.loadFailed")}
          </p>
        )}
        {runs.data?.runs.length === 0 && (
          <Link className="text-sm underline" to="/verification">
            {t("continuity.taskTestFirst")}
          </Link>
        )}
        {run.isFetching && !run.data && <Skeleton className="h-32 w-full" />}
        {run.isError && (
          <p role="alert">
            {actionErrorMessage(run.error) ?? t("continuity.loadFailed")}
          </p>
        )}
        {run.data && (
          <CreateTask
            key={`${run.data.id}-${run.data.revision}`}
            run={run.data}
            people={people}
            initialStep={params.get("stepNumber") || ""}
            onCreated={(id) => setParams({ workspaceId: active, taskId: id })}
          />
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <nav aria-label={t("continuity.tasks")} className="space-y-2">
          {list.isLoading && <Skeleton className="h-48 w-full" />}
          {list.isError && (
            <p role="alert">
              {actionErrorMessage(list.error) ?? t("continuity.loadFailed")}
              <Button variant="outline" onClick={() => void list.refetch()}>
                {t("continuity.retry")}
              </Button>
            </p>
          )}
          {list.data?.tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("continuity.taskEmpty")}
            </p>
          )}
          {list.data?.tasks.map((task) => {
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const overdue =
              task.status !== "done" &&
              task.assignmentStatus === "confirmed" &&
              Boolean(task.dueDate && task.dueDate < today);
            return (
              <Link
                key={task.id}
                to={task.urlPath}
                aria-current={task.id === taskId ? "page" : undefined}
                className={`block rounded-lg border p-4 text-sm ${task.id === taskId ? "bg-accent" : "bg-card"}`}
              >
                <span className="block break-words font-medium">
                  {task.title}
                </span>
                <span className="mt-2 block text-muted-foreground">
                  {task.assigneeName ?? t("continuity.planOwnerNeeded")} ·{" "}
                  {t(
                    task.assignmentStatus === "suggested"
                      ? "continuity.planSuggested"
                      : `continuity.task_${task.status}`,
                  )}
                </span>
                <span
                  className={`mt-1 block text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {t(overdue ? "continuity.taskOverdue" : "continuity.taskDue")}{" "}
                  {task.dueDate
                    ? new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                      }).format(new Date(`${task.dueDate}T12:00:00`))
                    : t("continuity.planDateNeeded")}
                </span>
              </Link>
            );
          })}
          {list.data?.hasMore && (
            <p className="text-xs text-muted-foreground">
              {t("continuity.taskMore")}
            </p>
          )}
        </nav>
        {detail.isError ? (
          <p role="alert">
            {actionErrorMessage(detail.error) ?? t("continuity.loadFailed")}
          </p>
        ) : taskId && detail.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : detail.data ? (
          <TaskEditor
            key={`${detail.data.id}-${detail.data.revision}`}
            task={detail.data}
            people={people}
          />
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            {t("continuity.taskSelect")}
          </p>
        )}
      </div>
    </div>
  );
}
function TaskFields({
  title,
  setTitle,
  assigneeId,
  setAssignee,
  dueDate,
  setDue,
  people,
  disabled,
  allowUnassigned = false,
}: {
  title: string;
  setTitle: (v: string) => void;
  assigneeId: string;
  setAssignee: (v: string) => void;
  dueDate: string;
  setDue: (v: string) => void;
  people: Person[];
  disabled: boolean;
  allowUnassigned?: boolean;
}) {
  const t = useT();
  const ownerLabel = useId();
  return (
    <div className="space-y-4">
      <label className="block space-y-2 text-sm">
        <span>{t("continuity.taskTitle")}</span>
        <Input
          disabled={disabled}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p id={ownerLabel} className="text-sm">
            {t("continuity.taskOwner")}
          </p>
          <Select
            disabled={disabled}
            value={assigneeId || (allowUnassigned ? "unassigned" : "")}
            onValueChange={(value) =>
              setAssignee(value === "unassigned" ? "" : value)
            }
          >
            <SelectTrigger aria-labelledby={ownerLabel}>
              <SelectValue placeholder={t("continuity.taskChooseOwner")} />
            </SelectTrigger>
            <SelectContent>
              {allowUnassigned && (
                <SelectItem value="unassigned">
                  {t("continuity.planOwnerNeeded")}
                </SelectItem>
              )}
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="block space-y-2 text-sm">
          <span>{t("continuity.taskDeadline")}</span>
          <Input
            disabled={disabled}
            type="date"
            value={dueDate}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
function CreateTask({
  run,
  people,
  initialStep,
  onCreated,
}: {
  run: z.infer<typeof verificationSchema>;
  people: Person[];
  initialStep: string;
  onCreated: (id: string) => void;
}) {
  const t = useT();
  const gaps = run.steps.filter(
    (s) => s.result === "blocked" || s.result === "unclear",
  );
  const [step, setStep] = useState(
    gaps.some((s) => String(s.number) === initialStep) ? initialStep : "",
  );
  const [title, setTitle] = useState("");
  const [assigneeId, setAssignee] = useState("");
  const [dueDate, setDue] = useState("");
  const create = useActionMutation("create-handover-tasks");
  const selected = gaps.find((s) => String(s.number) === step);
  if (!gaps.length)
    return (
      <p className="text-sm text-muted-foreground">
        {t("continuity.taskNoGaps")}
      </p>
    );
  return (
    <div className="space-y-4">
      <Select value={step} onValueChange={setStep} disabled={create.isPending}>
        <SelectTrigger aria-label={t("continuity.taskChooseGap")}>
          <SelectValue placeholder={t("continuity.taskChooseGap")} />
        </SelectTrigger>
        <SelectContent>
          {gaps.map((s) => (
            <SelectItem key={s.number} value={String(s.number)}>
              {t("continuity.taskStep", { number: s.number })} ·{" "}
              {t(`continuity.verification_${s.result}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <div className="border-l-2 pl-4 text-sm leading-6">
          <p>{selected.instruction}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {selected.notes}
          </p>
        </div>
      )}
      <TaskFields
        {...{
          title,
          setTitle,
          assigneeId,
          setAssignee,
          dueDate,
          setDue,
          people,
        }}
        disabled={create.isPending}
      />
      <Button
        disabled={
          create.isPending || !step || !title.trim() || !assigneeId || !dueDate
        }
        onClick={() =>
          create.mutate(
            {
              workspaceId: run.workspaceId,
              runId: run.id,
              sourceRevision: run.revision,
              tasks: [{ stepNumber: Number(step), title, assigneeId, dueDate }],
            },
            {
              onSuccess: (result) => {
                toast.success(
                  t(
                    result.insertedCount
                      ? "continuity.taskCreated"
                      : "continuity.taskExists",
                  ),
                );
                onCreated(result.tasks[0]!.id);
              },
            },
          )
        }
      >
        {t(
          create.isPending
            ? "continuity.verificationSaving"
            : "continuity.taskCreate",
        )}
      </Button>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {actionErrorMessage(create.error) ?? t("continuity.taskSaveFailed")}
        </p>
      )}
    </div>
  );
}
function TaskEditor({ task, people }: { task: Task; people: Person[] }) {
  const t = useT();
  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssignee] = useState(task.assigneeId ?? "");
  const [dueDate, setDue] = useState(task.dueDate ?? "");
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const suggested = task.assignmentStatus === "suggested";
  const [status, setStatus] = useState(task.status);
  const [resolution, setResolution] = useState(task.resolution);
  const update = useActionMutation("update-handover-task");
  const changed =
    title !== task.title ||
    description !== task.description ||
    priority !== task.priority ||
    assigneeId !== (task.assigneeId ?? "") ||
    dueDate !== (task.dueDate ?? "") ||
    status !== task.status ||
    resolution !== task.resolution;
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 space-y-5">
      <div className="space-y-2 text-sm">
        <h2 className="font-semibold">
          {t(
            task.findingId
              ? "continuity.planOriginalAssessment"
              : "continuity.taskOriginalGap",
          )}
        </h2>
        <p>{task.instruction}</p>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {task.gapNotes}
        </p>
        <div className="flex flex-wrap gap-4">
          <Link className="underline" to={task.sourceUrlPath}>
            {task.sourceName}
          </Link>
          {task.runUrlPath && (
            <Link className="underline" to={task.runUrlPath}>
              {t("continuity.taskViewTest")}
            </Link>
          )}
          {task.findingUrlPath && (
            <Link className="underline" to={task.findingUrlPath}>
              {t("continuity.planViewRisk")}
            </Link>
          )}
          {task.planUrlPath && (
            <Link className="underline" to={task.planUrlPath}>
              {t("continuity.planOpen")}
            </Link>
          )}
        </div>
      </div>
      {suggested && (
        <p className="text-sm text-muted-foreground">
          {t("continuity.planTaskPending")}
        </p>
      )}
      <TaskFields
        {...{
          title,
          setTitle,
          assigneeId,
          setAssignee,
          dueDate,
          setDue,
          people,
        }}
        disabled={update.isPending}
        allowUnassigned={suggested}
      />
      <label className="block space-y-2 text-sm">
        <span>{t("continuity.planTaskDescription")}</span>
        <Textarea
          value={description}
          maxLength={2000}
          disabled={update.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <Select
        value={priority}
        onValueChange={(v) => setPriority(v as typeof priority)}
        disabled={update.isPending}
      >
        <SelectTrigger aria-label={t("continuity.planPriority")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["critical", "high", "medium", "low"].map((p) => (
            <SelectItem key={p} value={p}>
              {t(`continuity.risk_${p}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={status}
        onValueChange={(value) => setStatus(value as Task["status"])}
        disabled={update.isPending}
      >
        <SelectTrigger aria-label={t("continuity.taskStatus")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["todo", "in_progress", "done"].map((value) => (
            <SelectItem
              key={value}
              value={value}
              disabled={suggested && value !== "todo"}
            >
              {t(`continuity.task_${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="block space-y-2 text-sm">
        <span>{t("continuity.taskResolution")}</span>
        <Textarea
          disabled={update.isPending}
          value={resolution}
          maxLength={4000}
          onChange={(e) => setResolution(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {t("continuity.taskRetest")}
      </p>
      <Button
        disabled={
          update.isPending ||
          !changed ||
          !title.trim() ||
          (!suggested && (!assigneeId || !dueDate)) ||
          (status === "done" && !resolution.trim())
        }
        onClick={() =>
          update.mutate(
            {
              workspaceId: task.workspaceId,
              id: task.id,
              revision: task.revision,
              title,
              description,
              priority,
              assigneeId: assigneeId || null,
              dueDate: dueDate || null,
              status,
              resolution,
            },
            { onSuccess: () => toast.success(t("continuity.taskSaved")) },
          )
        }
      >
        {t(
          update.isPending
            ? "continuity.verificationSaving"
            : "continuity.taskSave",
        )}
      </Button>
      {update.isSuccess && (
        <p role="status" className="text-sm">
          {t("continuity.taskSaved")}
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {actionErrorMessage(update.error) ?? t("continuity.taskSaveFailed")}
        </p>
      )}
    </section>
  );
}
