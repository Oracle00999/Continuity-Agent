import type { ActionRunContext } from "@agent-native/core/action";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import {
  knowledgeMapInput,
  knowledgeMapSchema,
  mapNodeSchema,
} from "../../shared/knowledge-map.js";
import { knowledgeClaimSchema } from "../../shared/knowledge.js";
import { getDb } from "../db/index.js";
import { relationships } from "../db/schema.js";
import { documentWorkspace } from "./documents.js";
import { knowledgeErrors } from "./knowledge.js";
import { knowledgeMachine } from "./knowledge-lifecycle.js";
export async function getKnowledgeMap(
  input: z.infer<typeof knowledgeMapInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (input.personId && !a.saved.people.some((p) => p.id === input.personId))
    return knowledgeErrors.noWrite(
      "Choose a person from this workspace.",
      "person_not_found",
      { statusCode: 404 },
    );
  const rows = await getDb()
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.workspaceId, a.workspace.id),
        eq(relationships.ownerEmail, a.ownerEmail),
        eq(relationships.orgId, a.orgId),
        ne(relationships.status, "rejected"),
        input.personId ? eq(relationships.personId, input.personId) : undefined,
        input.confirmedOnly ? eq(relationships.status, "confirmed") : undefined,
      ),
    )
    .orderBy(asc(relationships.createdAt), asc(relationships.id))
    .limit(151);
  const saved = rows.slice(0, 150);
  const nodes = new Map<string, z.infer<typeof mapNodeSchema>>();
  for (const person of a.saved.people.filter(
    (p) => !input.personId || p.id === input.personId,
  ))
    nodes.set(`person:${person.id}`, {
      id: `person:${person.id}`,
      entityId: person.id,
      kind: "person",
      name: person.name,
      description: person.role,
      departureDate: person.departureDate,
      urlPath: `/workspace?workspaceId=${encodeURIComponent(a.workspace.id)}&personId=${encodeURIComponent(person.id)}`,
    });
  const edges: z.infer<typeof knowledgeMapSchema>["edges"] = [];
  const claims = saved.map((row) => {
    const status = knowledgeMachine.parseState(row.status);
    const targetId = row.systemId ?? row.processId!;
    const target = `${row.targetKind}:${targetId}`;
    const system = a.saved.systems.find((s) => s.id === row.systemId);
    const doc = `document:${row.documentId}`;
    const path = `/documents?workspaceId=${encodeURIComponent(a.workspace.id)}&documentId=${encodeURIComponent(row.documentId)}`;
    nodes.set(target, {
      id: target,
      entityId: targetId,
      kind: row.targetKind === "system" ? "system" : "process",
      name: row.targetName,
      description: system?.description ?? null,
      departureDate: null,
      urlPath: null,
    });
    nodes.set(doc, {
      id: doc,
      entityId: row.documentId,
      kind: "document",
      name: row.sourceName,
      description: null,
      departureDate: null,
      urlPath: path,
    });
    if (status !== "rejected")
      edges.push(
        {
          id: `relationship:${row.id}`,
          source: `person:${row.personId}`,
          target,
          relationship: row.relationship,
          status,
          claimId: row.id,
        },
        {
          id: `source:${row.id}`,
          source: target,
          target: doc,
          relationship: "documented_in",
          status,
          claimId: row.id,
        },
      );
    return knowledgeClaimSchema.parse({
      ...row,
      targetId,
      status,
      urlPath: `${path}&evidenceId=${encodeURIComponent(row.evidenceId)}`,
    });
  });
  const selectedId =
    input.nodeId ?? (input.personId ? `person:${input.personId}` : undefined);
  const selectedNode = selectedId ? (nodes.get(selectedId) ?? null) : null;
  if (input.nodeId && !selectedNode)
    return knowledgeErrors.noWrite(
      "That item is not in the current map. Clear the selection or change the filters.",
      "knowledge_not_found",
      { statusCode: 404 },
    );
  const selectedClaims = selectedNode
    ? claims.filter(
        (c) =>
          selectedNode.id === `person:${c.personId}` ||
          selectedNode.id === `${c.targetKind}:${c.targetId}` ||
          selectedNode.id === `document:${c.documentId}`,
      )
    : [];
  return knowledgeMapSchema.parse({
    workspaceId: a.workspace.id,
    nodes: [...nodes.values()],
    edges,
    selectedNode,
    selectedClaims,
    hasMore: rows.length > 150,
    claimCount: saved.length,
  });
}
