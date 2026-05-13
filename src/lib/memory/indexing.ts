import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { embedText } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/db";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function embedMemory(memoryId: string) {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) {
    throw new Error("Memory not found");
  }

  await prisma.embedding.deleteMany({ where: { memoryId } });

  try {
    const embedding = await embedText(`${memory.title}\n\n${memory.content}`);
    await prisma.embedding.create({
      data: {
        memoryId,
        providerName: embedding.providerName,
        modelName: embedding.modelName,
        dimensions: embedding.dimensions,
        vectorJson: embedding.vector as Prisma.InputJsonValue,
      },
    });

    return prisma.memory.update({
      where: { id: memoryId },
      data: {
        metadata: {
          ...metadataRecord(memory.metadata),
          embeddingStatus: "INDEXED",
          embeddingModel: embedding.modelName,
          embeddingDimensions: embedding.dimensions,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    return prisma.memory.update({
      where: { id: memoryId },
      data: {
        metadata: {
          ...metadataRecord(memory.metadata),
          embeddingStatus: "ERROR",
          embeddingError: errorMessage(error).slice(0, 300),
        } as Prisma.InputJsonValue,
      },
    });
  }
}
