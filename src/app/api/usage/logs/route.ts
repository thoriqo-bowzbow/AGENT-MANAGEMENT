import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        apiKey: {
          select: { label: true, last4: true },
        },
      },
    });

    return Response.json({ logs });
  });
}
