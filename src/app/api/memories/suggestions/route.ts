import { NextRequest } from "next/server";

import { MemorySuggestionStatus } from "@/generated/prisma/enums";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const suggestions = await prisma.memorySuggestion.findMany({
      where: { userId: user.id, status: MemorySuggestionStatus.PENDING },
      include: { sourceConversation: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return Response.json({ suggestions });
  });
}
