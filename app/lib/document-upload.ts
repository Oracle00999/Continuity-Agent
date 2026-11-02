import { appPath } from "@agent-native/core/client/api-path";
import { z } from "zod";

const stagedUpload = z.object({ attachmentRef: z.string().min(1).max(4096) });
export class DocumentUploadError extends Error {}

export async function stageDocumentUpload(file: File, workspaceId: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("workspaceId", workspaceId);
  const response = await fetch(appPath("/api/document-upload"), {
    method: "POST",
    credentials: "same-origin",
    body,
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z
      .object({
        message: z.string().max(500).optional(),
        statusMessage: z.string().max(500).optional(),
      })
      .safeParse(result);
    throw new DocumentUploadError(
      error.success
        ? (error.data.message ??
            error.data.statusMessage ??
            "Document upload failed.")
        : "Document upload failed. Try again.",
    );
  }
  return stagedUpload.parse(result);
}
