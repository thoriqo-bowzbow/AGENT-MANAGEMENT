import { NextRequest } from "next/server";

import { MemorySuggestionStatus } from "@/generated/prisma/enums";
import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const suggestion = await prisma.memorySuggestion.findFirst({
      where: { id, userId: user.id, status: MemorySuggestionStatus.PENDING },
    });

    if (!suggestion) {
      return Response.json({ error: "Memory suggestion not found" }, { status: 404 });
    }

    const updatedSuggestion = await prisma.memorySuggestion.update({
      where: { id: suggestion.id },
      data: { status: MemorySuggestionStatus.REJECTED },
    });

    await auditLog({
      userId: user.id,
      action: "memory_suggestion.reject",
      entityType: "MemorySuggestion",
      entityId: suggestion.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ suggestion: updatedSuggestion });
  });
}
