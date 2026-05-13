import { NextRequest } from "next/server";

import { MessageRole } from "@/generated/prisma/enums";
import { auditLog } from "@/lib/audit";
import { buildContextMessages } from "@/lib/ai/context";
import { createRoutedChatStream, persistAssistantMessage, toRouterMessages } from "@/lib/ai/router";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpAddress, titleFromMessage } from "@/lib/utils";
import { chatStreamSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const ip = getIpAddress(request);

    if (!checkRateLimit(`chat:${user.id}:${ip}`, 30, 60_000)) {
      return Response.json({ error: "Terlalu banyak request. Coba lagi sebentar." }, { status: 429 });
    }

    const body = chatStreamSchema.parse(await readJson(request, {}));
    const route = body.routeId
      ? await prisma.route.findUnique({ where: { id: body.routeId } })
      : await prisma.route.findFirst({ where: { isDefault: true, isActive: true } });

    let conversation = body.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: body.conversationId, userId: user.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          routeId: route?.id,
          title: titleFromMessage(body.message),
          messages: {
            create: {
              role: MessageRole.SYSTEM,
              content:
                "You are Riqo AI Hub, a practical Indonesian-first personal AI assistant. Be clear, useful, and protect secrets.",
            },
          },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    const previousVisibleMessages = conversation.messages.filter(
      (message) => message.role !== MessageRole.SYSTEM || message.content,
    );

    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: body.message,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        routeId: route?.id || conversation.routeId,
        title:
          conversation.title === "New conversation"
            ? titleFromMessage(body.message)
            : conversation.title,
      },
    });

    const contextMessages = await buildContextMessages({
      userId: user.id,
      conversationId: conversation.id,
      messages: toRouterMessages([...previousVisibleMessages, userMessage]),
    });

    const routed = await createRoutedChatStream({
      userId: user.id,
      conversationId: conversation.id,
      routeId: route?.id || conversation.routeId || undefined,
      messages: contextMessages,
      signal: request.signal,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = "";
        try {
          for await (const chunk of routed.stream) {
            assistantContent += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          await persistAssistantMessage({
            conversationId: conversation.id,
            content: assistantContent,
            providerName: routed.attempt.provider.name,
            modelName: routed.attempt.usage.actualModel || routed.attempt.model,
            usage: routed.attempt.usage,
            metadata: {
              gatewayName: routed.attempt.provider.name,
              comboName: routed.attempt.model,
              actualModel: routed.attempt.usage.actualModel || routed.attempt.model,
              gatewayKeyLabel: routed.attempt.apiKey.label,
              gatewayKeyLast4: routed.attempt.apiKey.last4,
            },
          });
          await routed.finalize(assistantContent);
          await auditLog({
            userId: user.id,
            action: "chat.stream.success",
            entityType: "Conversation",
            entityId: conversation.id,
            metadata: {
              provider: routed.attempt.provider.name,
              combo: routed.attempt.model,
              actualModel: routed.attempt.usage.actualModel || routed.attempt.model,
              gatewayKeyLabel: routed.attempt.apiKey.label,
              gatewayKeyLast4: routed.attempt.apiKey.last4,
            },
            ipAddress: ip,
          });
        } catch (error) {
          await routed.fail(error);
          const message = error instanceof Error ? error.message : "Streaming failed";
          const visibleError = `\n\n[Router error] ${message}`;
          controller.enqueue(encoder.encode(visibleError));
          await persistAssistantMessage({
            conversationId: conversation.id,
            content: visibleError,
            providerName: routed.attempt.provider.name,
            modelName: routed.attempt.model,
            metadata: {
              gatewayName: routed.attempt.provider.name,
              comboName: routed.attempt.model,
              gatewayKeyLabel: routed.attempt.apiKey.label,
              gatewayKeyLast4: routed.attempt.apiKey.last4,
            },
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-conversation-id": conversation.id,
      },
    });
  });
}
