import { NextRequest } from "next/server";

import { MemoryScope, MemorySuggestionStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi } from "@/lib/api-helpers";
import { embedMemory } from "@/lib/memory/indexing";
import { getIpAddress } from "@/lib/utils";

type Context = {
  params: Promise<{ id: string }>;
};

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

    const useConversationScope =
      suggestion.scope === MemoryScope.CONVERSATION && Boolean(suggestion.sourceConversationId);
    const scope =
      suggestion.scope === MemoryScope.GLOBAL
        ? MemoryScope.GLOBAL
        : useConversationScope
          ? MemoryScope.CONVERSATION
          : MemoryScope.USER;

    let memory = await prisma.memory.create({
      data: {
        userId: useConversationScope ? undefined : user.id,
        conversationId: useConversationScope ? suggestion.sourceConversationId : undefined,
        scope,
        title: suggestion.title,
        content: suggestion.content,
        isEnabled: true,
        metadata: {
          source: "memory_suggestion",
          suggestionId: suggestion.id,
        },
      },
    });
    memory = await embedMemory(memory.id);

    const updatedSuggestion = await prisma.memorySuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: MemorySuggestionStatus.APPROVED,
        metadata: {
          ...metadataRecord(suggestion.metadata),
          approvedMemoryId: memory.id,
        } as Prisma.InputJsonValue,
      },
    });

    await auditLog({
      userId: user.id,
      action: "memory_suggestion.approve",
      entityType: "MemorySuggestion",
      entityId: suggestion.id,
      metadata: { memoryId: memory.id },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ memory, suggestion: updatedSuggestion });
  });
}
