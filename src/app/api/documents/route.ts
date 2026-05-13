import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const documents = await prisma.document.findMany({
      where: { userId: user.id },
      include: {
        conversation: { select: { id: true, title: true } },
        _count: { select: { chunks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json({ documents });
  });
}
