import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embedMemory } from "@/lib/memory/indexing";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";
import { updateMemorySchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

async function findOwnedMemory(userId: string, id: string) {
  return prisma.memory.findFirst({
    where: {
      id,
      OR: [{ userId }, { conversation: { userId } }],
    },
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const existing = await findOwnedMemory(user.id, id);

    if (!existing) {
      return Response.json({ error: "Memory not found" }, { status: 404 });
    }

    const body = updateMemorySchema.parse(await readJson(request, {}));
    let memory = await prisma.memory.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        isEnabled: body.isEnabled,
      },
    });

    if (body.title !== undefined || body.content !== undefined) {
      memory = await embedMemory(memory.id);
    }

    await auditLog({
      userId: user.id,
      action: "memory.update",
      entityType: "Memory",
      entityId: memory.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ memory });
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const existing = await findOwnedMemory(user.id, id);

    if (!existing) {
      return Response.json({ error: "Memory not found" }, { status: 404 });
    }

    await prisma.memory.delete({ where: { id } });
    await auditLog({
      userId: user.id,
      action: "memory.delete",
      entityType: "Memory",
      entityId: id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ok: true });
  });
}
