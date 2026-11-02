import { randomUUID } from "node:crypto";
import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  finalizeVerificationInput,
  recordVerificationInput,
  startVerificationInput,
  verificationSchema,
  verificationSummarySchema,
} from "../../shared/verification.js";
import { getDb } from "../db/index.js";
import {
  activityEvents,
  documents,
  verificationRuns as runs,
} from "../db/schema.js";
import { documentErrors } from "./document-errors.js";
import { documentWorkspace, getDocument } from "./documents.js";
import { verificationMachine as machine } from "./verification-lifecycle.js";

export const verificationErrors = defineActionErrors(
  "verification_not_found",
  "invalid_verification",
  "verification_conflict",
  ...documentErrors.codes,
);
type Access = Awaited<ReturnType<typeof documentWorkspace>>;
function scope(a: Access) {
  return and(
    eq(runs.workspaceId, a.workspace.id),
    eq(runs.ownerEmail, a.ownerEmail),
    eq(runs.orgId, a.orgId),
  );
}
function project(row: typeof runs.$inferSelect) {
  return verificationSchema.parse({
    ...row,
    status: machine.parseState(row.status),
    urlPath: `/verification?workspaceId=${encodeURIComponent(row.workspaceId)}&runId=${encodeURIComponent(row.id)}`,
  });
}
export async function listVerifications(
  input: { workspaceId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const rows = await getDb()
    .select({
      id: runs.id,
      workspaceId: runs.workspaceId,
      documentId: runs.documentId,
      sourceName: runs.sourceName,
      testerId: runs.testerId,
      testerName: runs.testerName,
      status: runs.status,
      revision: runs.revision,
      createdAt: runs.createdAt,
      updatedAt: runs.updatedAt,
    })
    .from(runs)
    .where(scope(a))
    .orderBy(desc(runs.createdAt), desc(runs.id))
    .limit(101);
  return {
    workspaceId: a.workspace.id,
    runs: rows
      .slice(0, 100)
      .map((row) =>
        verificationSummarySchema.parse({
          ...row,
          status: machine.parseState(row.status),
          urlPath: `/verification?workspaceId=${encodeURIComponent(row.workspaceId)}&runId=${encodeURIComponent(row.id)}`,
        }),
      ),
    hasMore: rows.length > 100,
  };
}
export async function getVerification(
  input: { id: string; workspaceId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [row] = await getDb()
    .select()
    .from(runs)
    .where(and(scope(a), eq(runs.id, input.id)))
    .limit(1);
  if (!row)
    return verificationErrors.noWrite(
      "That verification could not be found.",
      "verification_not_found",
      { statusCode: 404 },
    );
  return project(row);
}
function receipt(run: ReturnType<typeof project>, changed = true) {
  return {
    run,
    _receipt: {
      changed,
      verified: true,
      subject: run.id,
      summary: changed
        ? "Verification saved and read back."
        : "Existing verification returned.",
    },
  };
}
export async function startVerification(
  input: z.infer<typeof startVerificationInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const doc = await getDocument(
    { id: input.documentId, workspaceId: a.workspace.id },
    ctx,
  );
  const tester = a.saved.people.find((p) => p.id === input.testerId);
  if (!tester)
    return verificationErrors.noWrite(
      "Choose a tester from this workspace.",
      "person_not_found",
      { statusCode: 404 },
    );
  const instructions = doc.extractedText
    .split(/\r?\n/)
    .filter((line) => /^\s*\d+[.)]\s+\S/.test(line));
  if (
    doc.status !== "ready" ||
    !instructions.length ||
    instructions.length > 100
  )
    return verificationErrors.noWrite(
      "Choose a readable runbook with between 1 and 100 numbered steps.",
      "invalid_verification",
      { statusCode: 400 },
    );
  const [source] = await getDb()
    .select({ hash: documents.contentHash })
    .from(documents)
    .where(
      and(
        eq(documents.id, doc.id),
        eq(documents.ownerEmail, a.ownerEmail),
        eq(documents.orgId, a.orgId),
        eq(documents.workspaceId, a.workspace.id),
      ),
    );
  const now = new Date().toISOString();
  const id = randomUUID();
  const row = await getDb().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(runs)
      .values({
        id,
        ownerEmail: a.ownerEmail,
        orgId: a.orgId,
        workspaceId: a.workspace.id,
        documentId: doc.id,
        sourceName: doc.filename,
        sourceHash: source!.hash,
        testerId: tester.id,
        testerName: tester.name,
        requestId: input.requestId,
        status: machine.initial,
        steps: instructions.map((instruction, i) => ({
          number: i + 1,
          instruction,
          result: "pending" as const,
          notes: "",
        })),
        summary: "",
        revision: 0,
        createdAt: now,
        updatedAt: now,
        recordedBy: a.ownerEmail,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      await tx
        .insert(activityEvents)
        .values({
          id: randomUUID(),
          ownerEmail: a.ownerEmail,
          orgId: a.orgId,
          workspaceId: a.workspace.id,
          actor: a.ownerEmail,
          eventType: "verification_started",
          summary: `Assigned ${doc.filename} verification to ${tester.name}.`,
          createdAt: now,
        });
      return inserted;
    }
    const [existing] = await tx
      .select()
      .from(runs)
      .where(and(scope(a), eq(runs.requestId, input.requestId)));
    if (
      !existing ||
      existing.documentId !== doc.id ||
      existing.testerId !== tester.id
    )
      return verificationErrors.noWrite(
        "This request was already used for a different verification.",
        "verification_conflict",
        { statusCode: 409 },
      );
    return existing;
  });
  return receipt(
    await getVerification({ id: row.id, workspaceId: a.workspace.id }, ctx),
    row.id === id,
  );
}
export async function updateVerification(
  input:
    | z.infer<typeof recordVerificationInput>
    | z.infer<typeof finalizeVerificationInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const saved = await getVerification(input, ctx);
  if (saved.status !== "open" || saved.revision !== input.revision)
    return verificationErrors.noWrite(
      "This test changed or has been finalized. Refresh before saving.",
      "verification_conflict",
      { statusCode: 409 },
    );
  const finalizing = "outcome" in input;
  const event = finalizing ? input.outcome : "record";
  let steps = saved.steps;
  if (!finalizing) {
    const numbers = input.results.map((r) => r.number);
    if (
      new Set(numbers).size !== numbers.length ||
      numbers.some((n) => !steps.some((s) => s.number === n))
    )
      return verificationErrors.noWrite(
        "Choose each valid step once.",
        "invalid_verification",
        { statusCode: 400 },
      );
    steps = steps.map((s) => ({
      ...s,
      ...input.results.find((r) => r.number === s.number),
    }));
  } else {
    if (steps.some((s) => s.result === "pending"))
      return verificationErrors.noWrite(
        "Record a result for every step before finalizing.",
        "invalid_verification",
        { statusCode: 400 },
      );
    if (
      input.outcome === "passed" &&
      steps.some((s) => s.result !== "completed")
    )
      return verificationErrors.noWrite(
        "A pass requires every step to be completed.",
        "invalid_verification",
        { statusCode: 400 },
      );
    if (
      input.outcome === "passed_with_gaps" &&
      steps.some((s) => s.result === "blocked")
    )
      return verificationErrors.noWrite(
        "Blocked steps require a failed outcome.",
        "invalid_verification",
        { statusCode: 400 },
      );
  }
  const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(runs)
      .set({
        steps,
        status: machine.transition(saved.status, event),
        summary: finalizing ? input.summary : saved.summary,
        revision: saved.revision + 1,
        updatedAt: now,
        recordedBy: a.ownerEmail,
      })
      .where(
        and(
          scope(a),
          eq(runs.id, saved.id),
          eq(runs.revision, saved.revision),
          inArray(runs.status, machine.fromStates(event)),
        ),
      )
      .returning({ id: runs.id });
    if (!updated)
      return verificationErrors.noWrite(
        "Another update was saved. Refresh and try again.",
        "verification_conflict",
        { statusCode: 409 },
      );
    await tx
      .insert(activityEvents)
      .values({
        id: randomUUID(),
        ownerEmail: a.ownerEmail,
        orgId: a.orgId,
        workspaceId: a.workspace.id,
        actor: a.ownerEmail,
        eventType: finalizing
          ? "verification_finalized"
          : "verification_recorded",
        summary: finalizing
          ? `${saved.sourceName}: ${input.outcome}.`
          : `Results recorded for ${saved.sourceName}.`,
        createdAt: now,
      });
  });
  return receipt(await getVerification(input, ctx));
}
