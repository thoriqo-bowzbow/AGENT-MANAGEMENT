import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take: 500,
    });

    const summary = logs.reduce(
      (acc, log) => {
        acc.requests += 1;
        acc.inputTokens += log.inputTokens || 0;
        acc.outputTokens += log.outputTokens || 0;
        if (log.status === "ERROR") {
          acc.errors += 1;
        }
        acc.providers[log.providerName] = (acc.providers[log.providerName] || 0) + 1;
        acc.models[log.modelName] = (acc.models[log.modelName] || 0) + 1;
        return acc;
      },
      {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        errors: 0,
        providers: {} as Record<string, number>,
        models: {} as Record<string, number>,
      },
    );

    return Response.json({ summary });
  });
}
