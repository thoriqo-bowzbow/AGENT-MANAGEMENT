import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: {
        route: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json({ conversation });
  });
}
