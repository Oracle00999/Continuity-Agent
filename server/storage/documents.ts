import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getRuntimeDatabaseUrl } from "@agent-native/core/db";
import {
  PrivateBlobError,
  registerPrivateBlobProvider,
  type PrivateBlobHandle,
} from "@agent-native/core/private-blob";

const providerId = "continuity-local-documents";
function localPath(handle: PrivateBlobHandle) {
  if (handle.provider !== providerId || !/^[0-9a-f-]{36}$/.test(handle.id))
    throw new PrivateBlobError("Invalid local document handle.", "corrupt");
  return path.join(process.cwd(), "data", "document-blobs", handle.id);
}

// This is a configured private-blob provider, not a fallback for hosted storage.
// Sealed AttachmentRefs enforce owner/org scope before its read method is called.
export function ensureLocalDocumentStorage() {
  registerPrivateBlobProvider({
    id: providerId,
    name: "Local development document storage",
    isConfigured: () =>
      process.env.NODE_ENV !== "production" &&
      Boolean(getRuntimeDatabaseUrl()?.startsWith("pglite:")),
    handles: (request) => request.metadata?.purpose === "continuity-document",
    put: async (input) => {
      const handle: PrivateBlobHandle = {
        id: randomUUID(),
        provider: providerId,
        opaque: true,
        encrypted: false,
        mimeType: input.mimeType ?? "application/octet-stream",
        size: input.data.byteLength,
        createdAt: new Date().toISOString(),
      };
      const filename = localPath(handle);
      await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
      await writeFile(filename, input.data, { flag: "wx", mode: 0o600 });
      return handle;
    },
    read: async (handle) => {
      try {
        return {
          data: await readFile(localPath(handle)),
          handle,
          mimeType: handle.mimeType ?? "application/octet-stream",
        };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
          throw new PrivateBlobError(
            "The local document file is missing.",
            "not_found",
          );
        throw error;
      }
    },
    delete: async (handle) => {
      try {
        await unlink(localPath(handle));
        return { deleted: true, provider: providerId };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return { deleted: false, provider: providerId };
        throw error;
      }
    },
  });
}
