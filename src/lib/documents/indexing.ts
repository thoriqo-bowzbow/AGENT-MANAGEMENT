import "server-only";

import { readFile } from "node:fs/promises";

import { Prisma } from "@/generated/prisma/client";
import { embedTexts } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/db";
import { chunkText, extractTextFromBuffer } from "@/lib/documents/extract";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function replaceDocumentChunksWithEmbeddings(input: {
  documentId: string;
  chunks: string[];
  sourceFileName: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.documentChunk.deleteMany({ where: { documentId: input.documentId } });

  const createdChunks: Array<{ id: string; content: string }> = [];
  for (const [index, content] of input.chunks.entries()) {
    createdChunks.push(
      await prisma.documentChunk.create({
        data: {
          documentId: input.documentId,
          index,
          content,
          metadata: { sourceFileName: input.sourceFileName },
        },
      }),
    );
  }

  const metadata: Record<string, unknown> = {
    ...(input.metadata || {}),
    chunkCount: createdChunks.length,
    embeddingStatus: "SKIPPED",
  };

  if (createdChunks.length) {
    try {
      const embeddings = await embedTexts(createdChunks.map((chunk) => chunk.content));
      await prisma.embedding.createMany({
        data: embeddings.map((embedding, index) => ({
          documentChunkId: createdChunks[index].id,
          providerName: embedding.providerName,
          modelName: embedding.modelName,
          dimensions: embedding.dimensions,
          vectorJson: embedding.vector as Prisma.InputJsonValue,
        })),
      });

      metadata.embeddingStatus = "INDEXED";
      metadata.embeddingModel = embeddings[0]?.modelName || null;
      metadata.embeddingDimensions = embeddings[0]?.dimensions || null;
    } catch (error) {
      metadata.embeddingStatus = "ERROR";
      metadata.embeddingError = errorMessage(error).slice(0, 300);
    }
  }

  return prisma.document.update({
    where: { id: input.documentId },
    data: {
      status: "INDEXED",
      metadata: metadata as Prisma.InputJsonValue,
    },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function indexDocumentBuffer(input: {
  documentId: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}) {
  try {
    const extracted = await extractTextFromBuffer({
      buffer: input.buffer,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });

    return replaceDocumentChunksWithEmbeddings({
      documentId: input.documentId,
      chunks: chunkText(extracted.text),
      sourceFileName: input.fileName,
      metadata: { extractor: extracted.kind },
    });
  } catch (error) {
    await prisma.documentChunk.deleteMany({ where: { documentId: input.documentId } });
    return prisma.document.update({
      where: { id: input.documentId },
      data: {
        status: "ERROR",
        metadata: { extractionError: errorMessage(error).slice(0, 300) },
      },
      include: { _count: { select: { chunks: true } } },
    });
  }
}

export async function reindexStoredDocument(input: { documentId: string; userId: string }) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, userId: input.userId },
  });

  if (!document || !document.storagePath) {
    throw new Error("Document not found");
  }

  const buffer = await readFile(document.storagePath);
  return indexDocumentBuffer({
    documentId: document.id,
    buffer,
    fileName: document.fileName,
    mimeType: document.mimeType,
  });
}
