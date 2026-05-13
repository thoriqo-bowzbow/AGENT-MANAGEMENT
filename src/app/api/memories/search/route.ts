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
          memory: {
            isEnabled: true,
            OR: [{ userId: user.id }, { conversation: { userId: user.id } }],
          },
        },
        include: { memory: true },
        take: 500,
      });

      const memories = rankByEmbedding(queryEmbedding.vector, embeddings)
        .filter((item) => item.memory)
        .slice(0, body.limit)
        .map((item) => ({
          ...item.memory!,
          score: item.score,
          matchType: "semantic",
        }));

      return Response.json({ memories });
    } catch (error) {
      const terms = keywordTerms(body.query).slice(0, 8);
      const memories = await prisma.memory.findMany({
        where: {
          isEnabled: true,
          OR: [{ userId: user.id }, { conversation: { userId: user.id } }],
          ...(terms.length
            ? {
                AND: [
                  {
                    OR: terms.flatMap((term) => [
                      { title: { contains: term, mode: "insensitive" as const } },
                      { content: { contains: term, mode: "insensitive" as const } },
                    ]),
                  },
                ],
              }
            : {}),
        },
        take: body.limit,
        orderBy: { updatedAt: "desc" },
      });

      return Response.json({
        memories: memories.map((memory) => ({
          ...memory,
          score: keywordScore(body.query, `${memory.title}\n${memory.content}`),
          matchType: "keyword",
        })),
        fallbackReason: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
