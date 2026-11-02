import { randomUUID } from "node:crypto";
import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  knowledgeClaimSchema,
  saveKnowledgeInput,
  reviewKnowledgeInput,
} from "../../shared/knowledge.js";
import { getDb } from "../db/index.js";
import {
  relationships as claims,
  processes,
  activityEvents,
} from "../db/schema.js";
import { documentWorkspace, getDocument } from "./documents.js";
import { documentErrors } from "./document-errors.js";
import { knowledgeMachine as machine } from "./knowledge-lifecycle.js";
export const knowledgeErrors = defineActionErrors(
  "invalid_knowledge",
  "knowledge_not_found",
  "knowledge_conflict",
  ...documentErrors.codes,
);
type Access = Awaited<ReturnType<typeof documentWorkspace>>;
function scope(a: Access) {
  return and(
    eq(claims.workspaceId, a.workspace.id),
    eq(claims.ownerEmail, a.ownerEmail),
    eq(claims.orgId, a.orgId),
  );
}
function project(row: typeof claims.$inferSelect) {
  return knowledgeClaimSchema.parse({
    ...row,
    status: machine.parseState(row.status),
    targetId: row.systemId ?? row.processId,
    urlPath: `/documents?workspaceId=${encodeURIComponent(row.workspaceId)}&documentId=${encodeURIComponent(row.documentId)}&evidenceId=${encodeURIComponent(row.evidenceId)}`,
  });
}
const key = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
export async function listKnowledge(
  input: {
    workspaceId?: string | undefined;
    documentId?: string | undefined;
    personId?: string | undefined;
  },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (input.documentId)
    await getDocument(
      { workspaceId: a.workspace.id, id: input.documentId },
      ctx,
    );
  if (input.personId && !a.saved.people.some((p) => p.id === input.personId))
    return knowledgeErrors.noWrite(
      "That person could not be found.",
      "person_not_found",
      { statusCode: 404 },
    );
  const rows = await getDb()
    .select()
    .from(claims)
    .where(
      and(
        scope(a),
        input.documentId ? eq(claims.documentId, input.documentId) : undefined,
        input.personId ? eq(claims.personId, input.personId) : undefined,
      ),
    )
    .orderBy(asc(claims.createdAt), asc(claims.id))
    .limit(101);
  return {
    workspaceId: a.workspace.id,
    claims: rows.slice(0, 100).map(project),
    hasMore: rows.length > 100,
  };
}
export async function saveKnowledge(
  input: z.infer<typeof saveKnowledgeInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const doc = await getDocument(
    { workspaceId: a.workspace.id, id: input.documentId },
    ctx,
  );
  if (doc.status !== "ready")
    return knowledgeErrors.noWrite(
      "This document needs readable text before extracting knowledge.",
      "invalid_knowledge",
      { statusCode: 400 },
    );
  const prepared = input.claims.map((claim) => {
    const person = a.saved.people.find((p) => p.id === claim.personId);
    const passage = doc.evidence.find((e) => e.id === claim.evidenceId);
    const target = claim.target;
    const system =
      target.kind === "system"
        ? a.saved.systems.find((s) => s.id === target.id)
        : undefined;
    if (!person || (claim.target.kind === "system" && !system))
      return knowledgeErrors.noWrite(
        "Match people and systems to this workspace before saving.",
        "invalid_knowledge",
        { statusCode: 400 },
      );
    const name =
      claim.target.kind === "process" ? claim.target.name : system!.name;
    // Exact quote integrity is separate from semantic support; every claim still needs human review.
    if (
      !passage ||
      !passage.quote.includes(claim.quote) ||
      !key(claim.quote).includes(key(person.name)) ||
      !key(claim.quote).includes(key(name))
    )
      return knowledgeErrors.noWrite(
        "Use an exact passage from this document that explicitly names both the person and target. Leave uncertain matches unsaved.",
        "invalid_knowledge",
        { statusCode: 400 },
      );
    return {
      ...claim,
      personName: person.name,
      targetName: name,
      targetKey:
        claim.target.kind +
        ":" +
        (claim.target.kind === "system" ? claim.target.id : key(name)),
    };
  });
  const unique = new Set(
    prepared.map((c) =>
      JSON.stringify([c.personId, c.relationship, c.targetKey]),
    ),
  );
  if (unique.size !== prepared.length)
    return knowledgeErrors.noWrite(
      "Include each relationship only once in the batch.",
      "invalid_knowledge",
      { statusCode: 400 },
    );
  const now = new Date().toISOString();
  const result = await getDb().transaction(async (tx) => {
    const names = [
      ...new Map(
        prepared
          .filter((c) => c.target.kind === "process")
          .map((c) => [key(c.targetName), c.targetName]),
      ).entries(),
    ];
    let known: (typeof processes.$inferSelect)[] = [];
    if (names.length) {
      await tx
        .insert(processes)
        .values(
          names.map(([nameKey, name]) => ({
            id: randomUUID(),
            ownerEmail: a.ownerEmail,
            orgId: a.orgId,
            workspaceId: a.workspace.id,
            name,
            nameKey,
            createdAt: now,
          })),
        )
        .onConflictDoNothing();
      known = await tx
        .select()
        .from(processes)
        .where(
          and(
            eq(processes.workspaceId, a.workspace.id),
            eq(processes.ownerEmail, a.ownerEmail),
            eq(processes.orgId, a.orgId),
            inArray(
              processes.nameKey,
              names.map(([nameKey]) => nameKey),
            ),
          ),
        );
    }
    const values = prepared.map((c) => ({
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      documentId: doc.id,
      sourceName: doc.filename,
      personId: c.personId,
      personName: c.personName,
      relationship: c.relationship,
      targetKind: c.target.kind,
      targetKey: c.targetKey,
      targetName: c.targetName,
      systemId: c.target.kind === "system" ? c.target.id : null,
      processId:
        c.target.kind === "process"
          ? known.find((p) => p.nameKey === key(c.targetName))!.id
          : null,
      evidenceId: c.evidenceId,
      quote: c.quote,
      confidence: c.confidence,
      status: machine.initial,
      reviewNotes: "",
      revision: 0,
      createdAt: now,
      updatedAt: now,
      reviewedBy: null,
    }));
    const inserted = await tx
      .insert(claims)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: claims.id });
    if (inserted.length)
      await tx
        .insert(activityEvents)
        .values({
          id: randomUUID(),
          ownerEmail: a.ownerEmail,
          orgId: a.orgId,
          workspaceId: a.workspace.id,
          actor: a.ownerEmail,
          eventType: "knowledge_extracted",
          summary: `Saved ${inserted.length} candidate relationships from ${doc.filename} for review.`,
          createdAt: now,
        });
    const rows = await tx
      .select()
      .from(claims)
      .where(
        and(
          scope(a),
          eq(claims.documentId, doc.id),
          or(
            ...prepared.map((c) =>
              and(
                eq(claims.personId, c.personId),
                eq(claims.relationship, c.relationship),
                eq(claims.targetKey, c.targetKey),
              ),
            ),
          ),
        ),
      );
    return { rows, insertedCount: inserted.length };
  });
  return {
    claims: result.rows.map(project),
    insertedCount: result.insertedCount,
    _receipt: {
      changed: result.insertedCount > 0,
      verified: true,
      subject: doc.id,
      summary: `${result.insertedCount} candidate claims saved; ${result.rows.length} read back. Existing human reviews preserved.`,
    },
  };
}
export async function reviewKnowledge(
  input: z.infer<typeof reviewKnowledgeInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [saved] = await getDb()
    .select()
    .from(claims)
    .where(and(scope(a), eq(claims.id, input.id)))
    .limit(1);
  if (!saved)
    return knowledgeErrors.noWrite(
      "That relationship could not be found.",
      "knowledge_not_found",
      { statusCode: 404 },
    );
  if (saved.revision !== input.revision)
    return knowledgeErrors.noWrite(
      "This review changed. Refresh before saving.",
      "knowledge_conflict",
      { statusCode: 409 },
    );
  const status = machine.transition(
    machine.parseState(saved.status),
    input.status,
  );
  const now = new Date().toISOString();
  const row = await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(claims)
      .set({
        status,
        reviewNotes: input.notes,
        reviewedBy: a.ownerEmail,
        revision: input.revision + 1,
        updatedAt: now,
      })
      .where(
        and(
          scope(a),
          eq(claims.id, input.id),
          eq(claims.revision, input.revision),
          inArray(claims.status, machine.fromStates(input.status)),
        ),
      )
      .returning();
    if (!updated)
      return knowledgeErrors.noWrite(
        "Another review was saved. Refresh and try again.",
        "knowledge_conflict",
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
        eventType: "knowledge_reviewed",
        summary: `${saved.personName} → ${saved.targetName}: ${status}. Reviewer note: ${input.notes}`,
        createdAt: now,
      });
    const [verified] = await tx
      .select()
      .from(claims)
      .where(and(scope(a), eq(claims.id, input.id)));
    return verified!;
  });
  return {
    claim: project(row),
    _receipt: {
      changed: true,
      verified: true,
      subject: row.id,
      summary:
        "Human review saved and read back. No procedure readiness changed.",
    },
  };
}
