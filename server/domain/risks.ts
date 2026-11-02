import { randomUUID } from "node:crypto";
import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  riskSchema,
  riskSummarySchema,
  saveRisksInput,
  updateRiskInput,
} from "../../shared/risks.js";
import { getDb } from "../db/index.js";
import {
  findings,
  findingEvidence,
  evidence,
  documents,
  processes,
  verificationRuns,
  activityEvents,
} from "../db/schema.js";
import { documentWorkspace } from "./documents.js";
import { verificationErrors } from "./verification.js";
import { riskMachine as machine } from "./risk-lifecycle.js";
export const riskErrors = defineActionErrors(
  "risk_not_found",
  "invalid_risk",
  "risk_conflict",
  ...verificationErrors.codes,
);
type Access = Awaited<ReturnType<typeof documentWorkspace>>;
function scope(a: Access) {
  return and(
    eq(findings.workspaceId, a.workspace.id),
    eq(findings.ownerEmail, a.ownerEmail),
    eq(findings.orgId, a.orgId),
  );
}
function summary(row: typeof findings.$inferSelect) {
  return riskSummarySchema.parse({
    ...row,
    status: machine.parseState(row.status),
    urlPath: `/risks?workspaceId=${encodeURIComponent(row.workspaceId)}&findingId=${encodeURIComponent(row.id)}`,
  });
}
const summaryColumns = {
  id: findings.id,
  workspaceId: findings.workspaceId,
  key: findings.key,
  type: findings.type,
  title: findings.title,
  severity: findings.severity,
  status: findings.status,
  personId: findings.personId,
  personName: findings.personName,
  systemId: findings.systemId,
  systemName: findings.systemName,
  processId: findings.processId,
  processName: findings.processName,
  runId: findings.runId,
  revision: findings.revision,
  createdAt: findings.createdAt,
  updatedAt: findings.updatedAt,
};
export async function listRisks(
  input: {
    workspaceId?: string | undefined;
    personId?: string | undefined;
    status?: string | undefined;
  },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (input.personId && !a.saved.people.some((p) => p.id === input.personId))
    return riskErrors.noWrite(
      "Choose a person from this workspace.",
      "person_not_found",
      { statusCode: 404 },
    );
  const rows = await getDb()
    .select(summaryColumns)
    .from(findings)
    .where(
      and(
        scope(a),
        input.personId ? eq(findings.personId, input.personId) : undefined,
        input.status ? eq(findings.status, input.status) : undefined,
      ),
    )
    .orderBy(
      sql`CASE ${findings.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      desc(findings.createdAt),
      asc(findings.id),
    )
    .limit(101);
  return {
    workspaceId: a.workspace.id,
    findings: rows
      .slice(0, 100)
      .map((row) =>
        riskSummarySchema.parse({
          ...row,
          status: machine.parseState(row.status),
          urlPath: `/risks?workspaceId=${encodeURIComponent(row.workspaceId)}&findingId=${encodeURIComponent(row.id)}`,
        }),
      ),
    hasMore: rows.length > 100,
  };
}
export async function getRisk(
  input: { workspaceId?: string | undefined; id: string },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [row] = await getDb()
    .select()
    .from(findings)
    .where(and(scope(a), eq(findings.id, input.id)))
    .limit(1);
  if (!row)
    return riskErrors.noWrite(
      "That finding could not be found.",
      "risk_not_found",
      { statusCode: 404 },
    );
  const passages = await getDb()
    .select({
      evidenceId: findingEvidence.evidenceId,
      documentId: findingEvidence.documentId,
      sourceName: findingEvidence.sourceName,
      quote: findingEvidence.quote,
    })
    .from(findingEvidence)
    .where(
      and(
        eq(findingEvidence.workspaceId, a.workspace.id),
        eq(findingEvidence.ownerEmail, a.ownerEmail),
        eq(findingEvidence.orgId, a.orgId),
        eq(findingEvidence.findingId, row.id),
      ),
    )
    .orderBy(asc(findingEvidence.id));
  return riskSchema.parse({
    ...row,
    ...summary(row),
    evidence: passages.map((p) => ({
      ...p,
      urlPath: `/documents?workspaceId=${encodeURIComponent(a.workspace.id)}&documentId=${encodeURIComponent(p.documentId)}&evidenceId=${encodeURIComponent(p.evidenceId)}`,
    })),
  });
}
export async function saveRisks(
  input: z.infer<typeof saveRisksInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (new Set(input.findings.map((f) => f.key)).size !== input.findings.length)
    return riskErrors.noWrite(
      "Use each finding key only once in the batch.",
      "invalid_risk",
      { statusCode: 400 },
    );
  const evidenceIds = [
    ...new Set(
      input.findings.flatMap((f) => f.evidence.map((e) => e.evidenceId)),
    ),
  ];
  const passages = await getDb()
    .select({
      id: evidence.id,
      documentId: evidence.documentId,
      quote: evidence.quote,
      sourceName: documents.filename,
    })
    .from(evidence)
    .innerJoin(documents, eq(evidence.documentId, documents.id))
    .where(
      and(
        eq(evidence.workspaceId, a.workspace.id),
        eq(evidence.ownerEmail, a.ownerEmail),
        eq(evidence.orgId, a.orgId),
        eq(documents.workspaceId, a.workspace.id),
        eq(documents.ownerEmail, a.ownerEmail),
        eq(documents.orgId, a.orgId),
        inArray(evidence.id, evidenceIds),
      ),
    );
  const processIds = [
    ...new Set(
      input.findings.flatMap((f) => (f.processId ? [f.processId] : [])),
    ),
  ];
  const knownProcesses = processIds.length
    ? await getDb()
        .select({ id: processes.id, name: processes.name })
        .from(processes)
        .where(
          and(
            eq(processes.workspaceId, a.workspace.id),
            eq(processes.ownerEmail, a.ownerEmail),
            eq(processes.orgId, a.orgId),
            inArray(processes.id, processIds),
          ),
        )
    : [];
  const runIds = [
    ...new Set(input.findings.flatMap((f) => (f.runId ? [f.runId] : []))),
  ];
  const runs = runIds.length
    ? await getDb()
        .select()
        .from(verificationRuns)
        .where(
          and(
            eq(verificationRuns.workspaceId, a.workspace.id),
            eq(verificationRuns.ownerEmail, a.ownerEmail),
            eq(verificationRuns.orgId, a.orgId),
            inArray(verificationRuns.id, runIds),
          ),
        )
    : [];
  const now = new Date().toISOString();
  const prepared = input.findings.map((f) => {
    const person = f.personId
      ? a.saved.people.find((p) => p.id === f.personId)
      : null;
    const system = f.systemId
      ? a.saved.systems.find((s) => s.id === f.systemId)
      : null;
    const process = f.processId
      ? knownProcesses.find((p) => p.id === f.processId)
      : null;
    const run = f.runId ? runs.find((r) => r.id === f.runId) : null;
    if (
      (f.personId && !person) ||
      (f.systemId && !system) ||
      (f.processId && !process) ||
      (f.runId && !run)
    )
      return riskErrors.noWrite(
        "Related people, systems, procedures and tests must belong to this workspace.",
        "invalid_risk",
        { statusCode: 400 },
      );
    if (new Set(f.evidence.map((e) => e.evidenceId)).size !== f.evidence.length)
      return riskErrors.noWrite(
        "Cite each source passage once per finding.",
        "invalid_risk",
        { statusCode: 400 },
      );
    const quotes = f.evidence.map((item) => {
      const source = passages.find((p) => p.id === item.evidenceId);
      if (!source || !source.quote.includes(item.quote))
        return riskErrors.noWrite(
          "Every finding needs exact supporting quotes from saved sources in this workspace.",
          "invalid_risk",
          { statusCode: 400 },
        );
      return {
        ...item,
        documentId: source.documentId,
        sourceName: source.sourceName,
      };
    });
    if (
      f.type === "conflicting_information" &&
      new Set(quotes.map((q) => q.documentId)).size < 2
    )
      return riskErrors.noWrite(
        "A cross-source conflict needs passages from at least two documents.",
        "invalid_risk",
        { statusCode: 400 },
      );
    if (
      run &&
      (!quotes.some((q) => q.documentId === run.documentId) ||
        (!["failed", "passed_with_gaps"].includes(run.status) &&
          !run.steps.some(
            (s) => s.result === "blocked" || s.result === "unclear",
          )))
    )
      return riskErrors.noWrite(
        "Link a relevant test with reported gaps and cite that test's runbook.",
        "invalid_risk",
        { statusCode: 400 },
      );
    const snapshot = run
      ? {
          testerName: run.testerName,
          status: run.status,
          summary: run.summary,
          steps: run.steps.filter(
            (s) => s.result === "blocked" || s.result === "unclear",
          ),
          revision: run.revision,
          urlPath: `/verification?workspaceId=${encodeURIComponent(a.workspace.id)}&runId=${encodeURIComponent(run.id)}`,
        }
      : null;
    return {
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      key: f.key,
      type: f.type,
      title: f.title,
      description: f.description,
      severity: f.severity,
      severityReason: f.severityReason,
      confidence: f.confidence,
      uncertainty: f.uncertainty,
      recommendedAction: f.recommendedAction,
      status: machine.initial,
      personId: person?.id ?? null,
      personName: person?.name ?? null,
      systemId: system?.id ?? null,
      systemName: system?.name ?? null,
      processId: process?.id ?? null,
      processName: process?.name ?? null,
      runId: run?.id ?? null,
      verificationSnapshot: snapshot,
      reviewNotes: "",
      reviewedBy: null,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      quotes,
    };
  });
  const result = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(findings)
      .values(prepared.map(({ quotes, ...row }) => row))
      .onConflictDoNothing()
      .returning({ id: findings.id });
    const insertedIds = new Set(inserted.map((f) => f.id));
    const citations = prepared
      .filter((f) => insertedIds.has(f.id))
      .flatMap((f) =>
        f.quotes.map((q) => ({
          id: randomUUID(),
          ownerEmail: a.ownerEmail,
          orgId: a.orgId,
          workspaceId: a.workspace.id,
          findingId: f.id,
          ...q,
        })),
      );
    if (citations.length) await tx.insert(findingEvidence).values(citations);
    if (inserted.length)
      await tx
        .insert(activityEvents)
        .values({
          id: randomUUID(),
          ownerEmail: a.ownerEmail,
          orgId: a.orgId,
          workspaceId: a.workspace.id,
          actor: a.ownerEmail,
          eventType: "risks_proposed",
          summary: `Saved ${inserted.length} source-linked risk findings for review.`,
          createdAt: now,
        });
    const rows = await tx
      .select()
      .from(findings)
      .where(
        and(
          scope(a),
          inArray(
            findings.key,
            prepared.map((f) => f.key),
          ),
        ),
      );
    return { rows, insertedCount: inserted.length };
  });
  return {
    findings: result.rows.map(summary),
    insertedCount: result.insertedCount,
    _receipt: {
      changed: result.insertedCount > 0,
      verified: true,
      subject: a.workspace.id,
      summary: `${result.insertedCount} proposed findings saved; ${result.rows.length} read back. Existing reviews preserved.`,
    },
  };
}
export async function updateRisk(
  input: z.infer<typeof updateRiskInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const saved = await getRisk(input, ctx);
  if (saved.revision !== input.revision)
    return riskErrors.noWrite(
      "This finding changed. Refresh before saving.",
      "risk_conflict",
      { statusCode: 409 },
    );
  const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(findings)
      .set({
        title: input.title,
        description: input.description,
        severity: input.severity,
        severityReason: input.severityReason,
        confidence: input.confidence,
        uncertainty: input.uncertainty,
        recommendedAction: input.recommendedAction,
        status: machine.transition(saved.status, input.status),
        reviewNotes: input.reviewNotes,
        reviewedBy: a.ownerEmail,
        revision: input.revision + 1,
        updatedAt: now,
      })
      .where(
        and(
          scope(a),
          eq(findings.id, input.id),
          eq(findings.revision, input.revision),
          inArray(findings.status, machine.fromStates(input.status)),
        ),
      )
      .returning({ id: findings.id });
    if (!row)
      return riskErrors.noWrite(
        "Another review was saved. Refresh and try again.",
        "risk_conflict",
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
        eventType: "risk_reviewed",
        summary: `${input.title}: ${input.status}. Reviewer note: ${input.reviewNotes}`,
        createdAt: now,
      });
  });
  return {
    finding: await getRisk(input, ctx),
    _receipt: {
      changed: true,
      verified: true,
      subject: saved.id,
      summary:
        "Finding and human correction saved and read back. Procedure readiness unchanged.",
    },
  };
}
