import { createHash, randomUUID } from "node:crypto";

import type { ActionRunContext } from "@agent-native/core/action";
import {
  resolveAttachment,
  unwrapAttachment,
} from "@agent-native/core/private-blob";
import { and, asc, desc, eq } from "drizzle-orm";

import type { DocumentMention } from "../../shared/documents.js";
import { getDb } from "../db/index.js";
import { activityEvents, documents, evidence } from "../db/schema.js";
import { ensureLocalDocumentStorage } from "../storage/documents.js";
import { demoDocuments } from "./demo-documents.js";
import { documentErrors } from "./document-errors.js";
import {
  documentMimeType,
  extractDocumentText,
  splitEvidence,
  type ExtractedPage,
} from "./document-text.js";
import { getWorkspaceContext } from "./workspace.js";

export async function documentWorkspace(
  workspaceId: string | undefined,
  context?: ActionRunContext,
) {
  const saved = await getWorkspaceContext({ workspaceId }, context);
  if (!saved.workspace)
    return documentErrors.noWrite(
      "Load a workspace before adding documents.",
      "workspace_not_found",
      { statusCode: 404 },
    );
  if (!context?.userEmail)
    return documentErrors.noWrite(
      "Sign in to use documents.",
      "sign_in_required",
      { statusCode: 401 },
    );
  return {
    saved,
    workspace: saved.workspace,
    ownerEmail: context.userEmail,
    orgId: context.orgId ?? "",
  };
}

const summaryColumns = {
  id: documents.id,
  workspaceId: documents.workspaceId,
  filename: documents.filename,
  mimeType: documents.mimeType,
  source: documents.source,
  status: documents.status,
  byteSize: documents.byteSize,
  uploadedAt: documents.uploadedAt,
  passageCount: documents.passageCount,
  warnings: documents.warnings,
};

export async function listDocuments(
  input: { workspaceId?: string | undefined },
  context?: ActionRunContext,
) {
  const access = await documentWorkspace(input.workspaceId, context);
  const rows = await getDb()
    .select(summaryColumns)
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, access.workspace.id),
        eq(documents.ownerEmail, access.ownerEmail),
        eq(documents.orgId, access.orgId),
      ),
    )
    .orderBy(desc(documents.uploadedAt), asc(documents.id))
    .limit(101);
  return {
    workspaceId: access.workspace.id,
    documents: rows.slice(0, 100),
    hasMore: rows.length > 100,
  };
}

export async function getDocument(
  input: { id: string; workspaceId?: string | undefined },
  context?: ActionRunContext,
) {
  const access = await documentWorkspace(input.workspaceId, context);
  const db = getDb();
  const [document] = await db
    .select({ ...summaryColumns, extractedText: documents.extractedText })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.id),
        eq(documents.workspaceId, access.workspace.id),
        eq(documents.ownerEmail, access.ownerEmail),
        eq(documents.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!document)
    return documentErrors.fail(
      "Document not found or unavailable.",
      "document_not_found",
      { statusCode: 404 },
    );
  const passages = await db
    .select({
      id: evidence.id,
      documentId: evidence.documentId,
      quote: evidence.quote,
      section: evidence.section,
      pageNumber: evidence.pageNumber,
      startOffset: evidence.startOffset,
      endOffset: evidence.endOffset,
      mentions: evidence.mentions,
    })
    .from(evidence)
    .where(
      and(
        eq(evidence.documentId, document.id),
        eq(evidence.workspaceId, access.workspace.id),
        eq(evidence.ownerEmail, access.ownerEmail),
        eq(evidence.orgId, access.orgId),
      ),
    )
    .orderBy(asc(evidence.startOffset))
    .limit(2000);
  const urlPath = `/documents?workspaceId=${encodeURIComponent(access.workspace.id)}&documentId=${encodeURIComponent(document.id)}`;
  const sourceName = document.filename.replace(/[\\\[\]]/g, "\\$&");
  return {
    ...document,
    evidence: passages.map((passage) => ({
      ...passage,
      citation: `[${sourceName}](${urlPath}&evidenceId=${encodeURIComponent(passage.id)})`,
    })),
    urlPath,
    contentTrust: "untrusted_source_material" as const,
  };
}

type Access = Awaited<ReturnType<typeof documentWorkspace>>;
type Store = Pick<ReturnType<typeof getDb>, "select" | "insert">;
type Prepared = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  pages: ExtractedPage[];
  warnings: string[];
  source: "demo" | "upload";
  storageKey: string | null;
};

function mentionsFor(quote: string, access: Access): DocumentMention[] {
  const candidates: DocumentMention[] = [
    ...access.saved.people.map((person) => ({
      kind: "person" as const,
      id: person.id,
      name: person.name,
    })),
    ...access.saved.systems.map((system) => ({
      kind: "system" as const,
      id: system.id,
      name: system.name,
    })),
  ];
  return candidates.filter((candidate) => {
    const escaped = candidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      "iu",
    ).test(quote);
  });
}

async function persistDocument(tx: Store, access: Access, prepared: Prepared) {
  const contentHash = createHash("sha256").update(prepared.bytes).digest("hex");
  const split = splitEvidence(prepared.pages);
  const id = randomUUID();
  const tenant = {
    ownerEmail: access.ownerEmail,
    orgId: access.orgId,
    workspaceId: access.workspace.id,
  };
  const [inserted] = await tx
    .insert(documents)
    .values({
      id,
      ...tenant,
      filename: prepared.filename,
      mimeType: prepared.mimeType,
      storageKey: prepared.storageKey,
      contentHash,
      source: prepared.source,
      status: split.passages.length ? "ready" : "needs_text",
      extractedText: split.text,
      byteSize: prepared.bytes.byteLength,
      uploadedAt: new Date().toISOString(),
      warnings: prepared.warnings,
      passageCount: split.passages.length,
    })
    .onConflictDoNothing({
      target: [documents.workspaceId, documents.contentHash],
    })
    .returning({ id: documents.id });
  if (!inserted) {
    const [existing] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, access.workspace.id),
          eq(documents.contentHash, contentHash),
          eq(documents.ownerEmail, access.ownerEmail),
          eq(documents.orgId, access.orgId),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Document uniqueness invariant failed.");
    return { id: existing.id, inserted: false };
  }
  if (split.passages.length)
    await tx.insert(evidence).values(
      split.passages.map((passage) => ({
        ...passage,
        id: randomUUID(),
        ...tenant,
        documentId: id,
        mentions: mentionsFor(passage.quote, access),
      })),
    );
  await tx.insert(activityEvents).values({
    id: randomUUID(),
    ...tenant,
    actor: access.ownerEmail,
    eventType: "document_ingested",
    summary: `Saved ${prepared.filename} with ${split.passages.length} exact source passages.`,
    createdAt: new Date().toISOString(),
  });
  return { id, inserted: true };
}

export async function ingestDocument(
  input: { workspaceId?: string | undefined; attachmentRef: string },
  context?: ActionRunContext,
) {
  const access = await documentWorkspace(input.workspaceId, context);
  ensureLocalDocumentStorage();
  const file = unwrapAttachment(
    await resolveAttachment(input.attachmentRef, {
      ownerEmail: access.ownerEmail,
      orgId: access.orgId || null,
    }),
  );
  const extracted = await extractDocumentText(file.data, file.filename);
  const result = await getDb().transaction((tx) =>
    persistDocument(tx, access, {
      filename: file.filename,
      mimeType: documentMimeType(file.filename),
      bytes: file.data,
      ...extracted,
      source: "upload",
      storageKey: input.attachmentRef,
    }),
  );
  const document = await getDocument(
    { workspaceId: access.workspace.id, id: result.id },
    context,
  );
  return {
    document,
    duplicate: !result.inserted,
    _receipt: {
      changed: result.inserted,
      verified: true,
      subject: result.id,
      summary: result.inserted
        ? `Saved ${document.filename} and ${document.passageCount} source passages.`
        : "This document is already saved; existing records were preserved.",
    },
  };
}

export async function loadDemoDocuments(
  input: { workspaceId?: string | undefined },
  context?: ActionRunContext,
) {
  const access = await documentWorkspace(input.workspaceId, context);
  const insertedCount = await getDb().transaction(async (tx) => {
    let count = 0;
    for (const source of demoDocuments) {
      const result = await persistDocument(tx, access, {
        filename: source.filename,
        mimeType: "text/markdown",
        bytes: Buffer.from(source.text, "utf8"),
        pages: [{ text: source.text, pageNumber: null }],
        warnings: [],
        source: "demo",
        storageKey: null,
      });
      if (result.inserted) count++;
    }
    return count;
  });
  const result = await listDocuments(
    { workspaceId: access.workspace.id },
    context,
  );
  return {
    workspaceId: result.workspaceId,
    insertedCount,
    documents: result.documents,
    _receipt: {
      changed: insertedCount > 0,
      verified: true,
      subject: access.workspace.id,
      summary: insertedCount
        ? `Saved ${insertedCount} demo runbooks with source passages.`
        : "All demo runbooks are already saved.",
    },
  };
}
