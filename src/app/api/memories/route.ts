import { NextRequest } from "next/server";

import { MemoryScope } from "@/generated/prisma/enums";
import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embedMemory } from "@/lib/memory/indexing";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";
import { createMemorySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const memories = await prisma.memory.findMany({
      where: {
        OR: [{ userId: user.id }, { conversation: { userId: user.id } }],
      },
      include: {
        conversation: { select: { id: true, title: true } },
      },
      orderBy: [{ isEnabled: "desc" }, { updatedAt: "desc" }],
    });

    return Response.json({ memories });
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = createMemorySchema.parse(await readJson(request, {}));
    let conversationId: string | undefined;

    if (body.scope === MemoryScope.CONVERSATION) {
      if (!body.conversationId) {
        return Response.json({ error: "conversationId is required for conversation memory" }, { status: 422 });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
      });

      if (!conversation) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }

      conversationId = conversation.id;
    }

    const memory = await prisma.memory.create({
      data: {
        userId: conversationId ? undefined : user.id,
        conversationId,
        scope: body.scope,
        title: body.title,
        content: body.content,
      },
    });
    const embeddedMemory = await embedMemory(memory.id);

    await auditLog({
      userId: user.id,
      action: "memory.create",
      entityType: "Memory",
      entityId: memory.id,
      metadata: { scope: body.scope },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ memory: embeddedMemory }, { status: 201 });
  });
}
