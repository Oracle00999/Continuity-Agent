import { isActionContractError } from "@agent-native/core/action";
import { getOrgContext } from "@agent-native/core/org";
import { mintAttachmentRef } from "@agent-native/core/private-blob";
import { getSession, runWithRequestContext } from "@agent-native/core/server";
import {
  assertBodySize,
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  setResponseStatus,
} from "h3";

import { MAX_DOCUMENT_BYTES } from "../../../shared/documents.js";
import { validateDocumentBytes } from "../../domain/document-text.js";
import { documentWorkspace } from "../../domain/documents.js";
import { ensureLocalDocumentStorage } from "../../storage/documents.js";

// Multipart transport only. Extraction and all domain writes are shared actions.
export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email)
    throw createError({
      statusCode: 401,
      message: "Sign in before uploading a document.",
    });
  if (getHeader(event, "origin") !== getRequestURL(event).origin)
    throw createError({
      statusCode: 403,
      message: "Upload documents from this application.",
    });
  assertBodySize(event, MAX_DOCUMENT_BYTES + 32_768);
  const contentType = getHeader(event, "content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw createError({
      statusCode: 415,
      message: "Upload a multipart document file.",
    });
  // H3's size-limited request wraps formData() in a headerless Response.
  // Keep its bounded byte reader, then restore the multipart content type.
  const boundedBody = await event.req.arrayBuffer();
  let form: FormData;
  try {
    form = await new Response(boundedBody, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw createError({
      statusCode: 400,
      message: "The document upload was malformed. Choose the file again.",
    });
  }
  const file = form.get("file");
  const workspaceId = form.get("workspaceId");
  if (
    !(file instanceof File) ||
    typeof workspaceId !== "string" ||
    !workspaceId ||
    workspaceId.length > 200
  )
    throw createError({
      statusCode: 400,
      message: "Choose a file and a workspace.",
    });
  const orgId = (await getOrgContext(event)).orgId;
  try {
    return await runWithRequestContext(
      { userEmail: session.email, ...(orgId ? { orgId } : {}) },
      async () => {
        await documentWorkspace(workspaceId, {
          caller: "http",
          userEmail: session.email,
          orgId,
        });
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mimeType = validateDocumentBytes(bytes, file.name);
        ensureLocalDocumentStorage();
        const stored = await mintAttachmentRef({
          data: bytes,
          filename: file.name,
          mimeType,
          ownerEmail: session.email,
          orgId,
          metadata: { purpose: "continuity-document" },
        });
        if (stored.status !== "ok")
          throw createError({
            statusCode: 503,
            message:
              "Document storage is unavailable. Configure file storage in Settings, then retry.",
          });
        setResponseStatus(event, 201);
        return { attachmentRef: stored.ref };
      },
    );
  } catch (error: unknown) {
    if (isActionContractError(error))
      throw createError({
        statusCode: error.statusCode,
        message: error.message,
      });
    throw error;
  }
});
