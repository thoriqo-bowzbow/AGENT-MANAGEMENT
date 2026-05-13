import "server-only";

import { embedText, rankByEmbedding } from "@/lib/ai/embeddings";
import type { RouterChatMessage } from "@/lib/ai/types";
import { prisma } from "@/lib/db";

function termsFromQuery(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9\u00c0-\u024f]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 4)
        .slice(0, 8),
    ),
  );
}

function buildSystemContext(parts: string[], messages: RouterChatMessage[]) {
  if (!parts.length) {
    return messages;
  }

  return [
    {
      role: "system" as const,
      content:
        "Use the following local Riqo AI Hub context when relevant. Do not claim context exists if it is not useful.\n\n" +
        parts.join("\n\n"),
    },
    ...messages,
  ];
}

async function buildKeywordContext(input: {
  userId: string;
  conversationId: string;
  latestUserMessage: string;
  messages: RouterChatMessage[];
  includeMemories: boolean;
}) {
  const terms = termsFromQuery(input.latestUserMessage);
  const contextParts: string[] = [];

  if (input.includeMemories) {
    const memories = await prisma.memory.findMany({
      where: {
        isEnabled: true,
        OR: [
          { userId: input.userId, scope: { in: ["GLOBAL", "USER"] } },
          { conversationId: input.conversationId },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });

    if (memories.length) {
      contextParts.push(
        `Approved memory context:\n${memories
          .map((memory) => `- ${memory.title}: ${memory.content}`)
          .join("\n")}`,
      );
    }
  }

  const chunkWhere =
    terms.length > 0
      ? {
          OR: terms.map((term) => ({
            content: { contains: term, mode: "insensitive" as const },
          })),
        }
      : {};

  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        userId: input.userId,
        OR: [{ conversationId: input.conversationId }, { conversationId: null }],
      },
      ...chunkWhere,
    },
    include: {
      document: {
        select: { title: true, fileName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  if (chunks.length) {
    contextParts.push(
      `Relevant document context:\n${chunks
        .map(
          (chunk) =>
            `Source: ${chunk.document.title || chunk.document.fileName}\n${chunk.content.slice(0, 1400)}`,
        )
        .join("\n\n---\n\n")}`,
    );
  }

  return buildSystemContext(contextParts, input.messages);
}

export async function buildContextMessages(input: {
  userId: string;
  conversationId: string;
  messages: RouterChatMessage[];
}) {
  const latestUserMessage =
    [...input.messages].reverse().find((message) => message.role === "user")?.content || "";

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    select: { memoryEnabled: true },
  });
  const includeMemories = conversation?.memoryEnabled !== false;

  if (!latestUserMessage.trim()) {
    return buildKeywordContext({ ...input, latestUserMessage, includeMemories });
  }

  try {
    const queryEmbedding = await embedText(latestUserMessage);
    const contextParts: string[] = [];

    if (includeMemories) {
      const memoryEmbeddings = await prisma.embedding.findMany({
        where: {
          memory: {
            isEnabled: true,
            OR: [
              { userId: input.userId, scope: { in: ["GLOBAL", "USER"] } },
              { conversationId: input.conversationId },
            ],
          },
        },
        include: { memory: true },
        take: 500,
      });

      const memories = rankByEmbedding(queryEmbedding.vector, memoryEmbeddings)
        .filter((item) => item.memory && item.score > 0.05)
        .slice(0, 8);

      if (memories.length) {
        contextParts.push(
          `Approved memory context:\n${memories
            .map((item) => `- ${item.memory!.title} (score ${item.score.toFixed(3)}): ${item.memory!.content}`)
            .join("\n")}`,
        );
      }
    }

    const documentEmbeddings = await prisma.embedding.findMany({
      where: {
        documentChunk: {
          document: {
            userId: input.userId,
            OR: [{ conversationId: input.conversationId }, { conversationId: null }],
          },
        },
      },
      include: {
        documentChunk: {
          include: {
            document: { select: { title: true, fileName: true } },
          },
        },
      },
      take: 500,
    });

    const chunks = rankByEmbedding(queryEmbedding.vector, documentEmbeddings)
      .filter((item) => item.documentChunk && item.score > 0.05)
      .slice(0, 6);

    if (chunks.length) {
      contextParts.push(
        `Relevant document context:\n${chunks
          .map((item) => {
            const chunk = item.documentChunk!;
            return `Source: ${chunk.document.title || chunk.document.fileName} (score ${item.score.toFixed(3)})\n${chunk.content.slice(0, 1400)}`;
          })
          .join("\n\n---\n\n")}`,
      );
    }

    if (contextParts.length) {
      return buildSystemContext(contextParts, input.messages);
    }
  } catch {
    // Semantic retrieval is optional in local dev. Keyword context keeps chat usable when /embeddings is unavailable.
  }

  return buildKeywordContext({ ...input, latestUserMessage, includeMemories });
}
