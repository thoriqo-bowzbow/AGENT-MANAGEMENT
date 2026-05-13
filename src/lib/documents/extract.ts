import "server-only";

import path from "node:path";

export type ExtractedDocument = {
  text: string;
  kind: "text" | "pdf" | "docx" | "spreadsheet";
};

function extension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function chunkText(text: string, size = 1400, overlap = 180) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
}

export async function extractTextFromBuffer(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}): Promise<ExtractedDocument> {
  const ext = extension(input.fileName);

  if ([".txt", ".md", ".csv", ".json", ".log"].includes(ext)) {
    return {
      text: input.buffer.toString("utf8"),
      kind: "text",
    };
  }

  if (ext === ".pdf" || input.mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    return {
      text: parsed.text || "",
      kind: "pdf",
    };
  }

  if (
    ext === ".docx" ||
    input.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer: input.buffer });
    return {
      text: parsed.value || "",
      kind: "docx",
    };
  }

  if (
    [".xlsx", ".xls"].includes(ext) ||
    input.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(input.buffer, { type: "buffer" });
    const text = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `# ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");

    return {
      text,
      kind: "spreadsheet",
    };
  }

  throw new Error(`Unsupported file type: ${ext || input.mimeType || "unknown"}`);
}

export function safeStorageName(fileName: string) {
  const ext = path.extname(fileName);
  const base = path
    .basename(fileName, ext)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "document"}-${Date.now()}${ext.toLowerCase()}`;
}
