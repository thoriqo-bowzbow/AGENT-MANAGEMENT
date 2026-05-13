import { NextRequest } from "next/server";

import { MessageRole } from "@/generated/prisma/enums";
import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";
import { createConversationSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      include: {
        route: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });

    return Response.json({ conversations });
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = createConversationSchema.parse(await readJson(request, {}));
    const route = body.routeId
      ? await prisma.route.findUnique({ where: { id: body.routeId } })
      : await prisma.route.findFirst({ where: { isDefault: true, isActive: true } });

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        routeId: route?.id,
        title: body.title || "New conversation",
        messages: {
          create: {
            role: MessageRole.SYSTEM,
            content:
              "You are Riqo AI Hub, a practical Indonesian-first personal AI assistant. Be clear, useful, and protect secrets.",
          },
        },
      },
      include: { route: true, messages: { orderBy: { createdAt: "asc" } } },
    });

    await auditLog({
      userId: user.id,
      action: "conversation.create",
      entityType: "Conversation",
      entityId: conversation.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ conversation }, { status: 201 });
  });
}
