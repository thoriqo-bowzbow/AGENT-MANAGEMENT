import { NextRequest } from "next/server";

import { embedText, rankByEmbedding } from "@/lib/ai/embeddings";
import { keywordScore, keywordTerms } from "@/lib/ai/embedding-utils";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { searchSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = searchSchema.parse(await readJson(request, {}));

    try {
      const queryEmbedding = await embedText(body.query);
      const embeddings = await prisma.embedding.findMany({
        where: {
          documentChunk: {
            document: {
              userId: user.id,
              ...(body.conversationId ? { conversationId: body.conversationId } : {}),
            },
          },
        },
        include: {
          documentChunk: {
            include: {
              document: { select: { id: true, title: true, fileName: true, status: true } },
            },
          },
        },
        take: 500,
      });

      const chunks = rankByEmbedding(queryEmbedding.vector, embeddings)
        .filter((item) => item.documentChunk)
        .slice(0, body.limit)
        .map((item) => ({
          id: item.documentChunk!.id,
          content: item.documentChunk!.content,
          document: item.documentChunk!.document,
          score: item.score,
          matchType: "semantic",
        }));

      return Response.json({ chunks });
    } catch (error) {
      const terms = keywordTerms(body.query).slice(0, 8);
      const chunks = await prisma.documentChunk.findMany({
        where: {
          ...(terms.length
            ? {
                OR: terms.map((term) => ({
                  content: { contains: term, mode: "insensitive" as const },
                })),
              }
            : {}),
          document: {
            userId: user.id,
            ...(body.conversationId ? { conversationId: body.conversationId } : {}),
          },
        },
        include: {
          document: { select: { id: true, title: true, fileName: true, status: true } },
        },
        take: body.limit,
        orderBy: { createdAt: "desc" },
      });

      return Response.json({
        chunks: chunks.map((chunk) => ({
          ...chunk,
          score: keywordScore(body.query, chunk.content),
          matchType: "keyword",
        })),
        fallbackReason: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
