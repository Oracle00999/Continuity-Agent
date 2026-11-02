import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_TEXT,
} from "../../shared/documents.js";
import { documentErrors } from "./document-errors.js";

export type ExtractedPage = { text: string; pageNumber: number | null };

export function documentMimeType(filename: string) {
  if (filename.length > 180 || /[/\\\x00-\x1f]/.test(filename))
    return documentErrors.noWrite(
      "Use a filename of at most 180 characters without path separators.",
      "invalid_document",
    );
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  if (/\.(md|markdown)$/i.test(filename)) return "text/markdown";
  if (/\.txt$/i.test(filename)) return "text/plain";
  return documentErrors.noWrite(
    "Choose a PDF, Markdown, or plain text document.",
    "invalid_document",
    { statusCode: 415 },
  );
}

export function validateDocumentBytes(data: Uint8Array, filename: string) {
  const mimeType = documentMimeType(filename);
  if (data.byteLength > MAX_DOCUMENT_BYTES)
    documentErrors.noWrite(
      "Documents must be 5 MB or smaller.",
      "document_too_large",
      { statusCode: 413 },
    );
  if (!data.byteLength)
    documentErrors.noWrite("The selected file is empty.", "invalid_document");
  if (
    mimeType === "application/pdf" &&
    Buffer.from(data.subarray(0, 5)).toString("ascii") !== "%PDF-"
  )
    documentErrors.noWrite(
      "This file does not contain a valid PDF header.",
      "invalid_document",
    );
  return mimeType;
}

export async function extractDocumentText(
  data: Uint8Array,
  filename: string,
): Promise<{ pages: ExtractedPage[]; warnings: string[] }> {
  const mimeType = validateDocumentBytes(data, filename);
  if (mimeType !== "application/pdf") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      return documentErrors.noWrite(
        "Save text documents as UTF-8 before uploading.",
        "invalid_document",
      );
    }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
      documentErrors.noWrite(
        "The selected file contains binary data rather than plain text.",
        "invalid_document",
      );
    if (text.length > MAX_DOCUMENT_TEXT)
      documentErrors.noWrite(
        "Extracted text must be 200,000 characters or fewer.",
        "document_too_large",
        { statusCode: 413 },
      );
    return {
      pages: [{ text: text.replace(/\r\n?/g, "\n"), pageNumber: null }],
      warnings: text.trim() ? [] : ["No readable text was found in this file."],
    };
  }
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(new Uint8Array(data), {
      maxImageSize: 1_000_000,
      useWorkerFetch: false,
    });
    if (pdf.numPages > 100)
      return documentErrors.noWrite(
        "PDF documents must have 100 pages or fewer.",
        "document_too_large",
        { statusCode: 413 },
      );
    const result = await extractText(pdf, { mergePages: false });
    if (result.text.join("\n\n").length > MAX_DOCUMENT_TEXT)
      return documentErrors.noWrite(
        "Extracted text must be 200,000 characters or fewer.",
        "document_too_large",
        { statusCode: 413 },
      );
    const emptyPages = result.text.flatMap((text, index) =>
      text.trim() ? [] : [index + 1],
    );
    return {
      pages: result.text.map((text, index) => ({
        text: text.replace(/\r\n?/g, "\n"),
        pageNumber: index + 1,
      })),
      warnings: emptyPages.length
        ? [
            `No readable text on page(s) ${emptyPages.join(", ")}. Scanned pages require OCR; image content was not interpreted.`,
          ]
        : [],
    };
  } catch (error) {
    if (error && typeof error === "object" && "errorCode" in error) throw error;
    return documentErrors.noWrite(
      "This PDF could not be read. It may be damaged or password-protected.",
      "document_parse_failed",
    );
  } finally {
    await pdf?.loadingTask.destroy();
  }
}

export function splitEvidence(pages: ExtractedPage[]) {
  const text = pages.map((page) => page.text).join("\n\n");
  const passages: {
    quote: string;
    section: string | null;
    pageNumber: number | null;
    startOffset: number;
    endOffset: number;
  }[] = [];
  let pageOffset = 0;
  let section: string | null = null;
  for (const page of pages) {
    const blocks = page.text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g);
    for (const block of blocks) {
      const blockText = block[0];
      const heading = /^#{1,6}\s+([^\n]+)/.exec(blockText);
      if (heading) section = heading[1]?.trim() ?? null;
      // Bound passages without rewriting text: offsets always slice extractedText.
      for (let offset = 0; offset < blockText.length; offset += 1000) {
        const chunk = blockText.slice(offset, offset + 1000);
        const lead = chunk.search(/\S/);
        if (lead < 0) continue;
        const startOffset = pageOffset + block.index + offset + lead;
        const endOffset =
          pageOffset + block.index + offset + chunk.trimEnd().length;
        passages.push({
          quote: text.slice(startOffset, endOffset),
          section,
          pageNumber: page.pageNumber,
          startOffset,
          endOffset,
        });
      }
    }
    pageOffset += page.text.length + 2;
  }
  if (passages.length > 1000)
    documentErrors.noWrite(
      "This document contains too many separate passages. Split it into smaller documents.",
      "document_too_large",
      { statusCode: 413 },
    );
  return { text, passages };
}
