import "server-only";

import { MemoryScope } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getActiveNineRouterCredential } from "@/lib/9router";
import { prisma } from "@/lib/db";

type RawSuggestion = {
  title?: unknown;
  content?: unknown;
  scope?: unknown;
  reason?: unknown;
};

type NormalizedSuggestion = {
  title: string;
  content: string;
  scope: MemoryScope;
  reason: string | null;
};

function stripCodeFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractJsonArray(text: string) {
  const cleaned = stripCodeFence(text);
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error("AI tidak mengembalikan JSON array memory suggestion.");
  }

  return cleaned.slice(firstBracket, lastBracket + 1);
}

function normalizeScope(scope: unknown) {
  if (typeof scope !== "string") {
    return MemoryScope.USER;
  }

  const upper = scope.toUpperCase();
  return Object.values(MemoryScope).includes(upper as MemoryScope) ? (upper as MemoryScope) : MemoryScope.USER;
}

function looksSecretish(value: string) {
  return /(api[_ -]?key|password|token|secret|bearer|oauth|sk-[a-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{10,})/i.test(value);
}

function normalizeSuggestion(item: RawSuggestion): NormalizedSuggestion | null {
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
  const content = typeof item.content === "string" ? item.content.trim().slice(0, 20_000) : "";
  const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, 500) : null;
  const scope = normalizeScope(item.scope);

  if (!title || !content || looksSecretish(`${title}\n${content}`)) {
    return null;
  }

  return { title, content, reason, scope };
}

export async function suggestMemoriesFromConversation(input: {
  userId: string;
  conversationId: string;
  limit: number;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    include: {
      messages: {
        where: { role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "asc" },
        take: 30,
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!conversation.messages.length) {
    return [];
  }

  const transcript = conversation.messages
    .slice(-20)
    .map((message) => `${message.role}: ${message.content.slice(0, 1600)}`)
    .join("\n\n");
  const credential = await getActiveNineRouterCredential();

  try {
    const response = await fetch(`${credential.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: credential.chatModelName || "COMBO-9ROUTER",
        stream: false,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You create memory suggestions for a personal AI workspace. Return JSON array only. Suggest only durable, useful facts or preferences for future chats. Never suggest secrets, API keys, tokens, passwords, or sensitive credentials. Each item: title, content, scope, reason. Scope should usually be USER.",
          },
          {
            role: "user",
            content: `Conversation title: ${conversation.title}\n\nTranscript:\n${transcript}\n\nCreate up to ${input.limit} memory suggestions.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Memory suggestion gagal ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(extractJsonArray(content)) as RawSuggestion[];
    const suggestions = parsed.map(normalizeSuggestion).filter((item): item is NormalizedSuggestion => Boolean(item));

    await prisma.providerApiKey.update({
      where: { id: credential.keyId },
      data: { requestCount: { increment: 1 }, lastUsedAt: new Date(), lastError: null },
    });

    const created = [];
    for (const suggestion of suggestions.slice(0, input.limit)) {
      created.push(
        await prisma.memorySuggestion.create({
          data: {
            userId: input.userId,
            sourceConversationId: conversation.id,
            title: suggestion.title,
            content: suggestion.content,
            scope: suggestion.scope,
            reason: suggestion.reason,
            metadata: {
              suggestedBy: credential.providerName,
              modelName: credential.chatModelName,
            } as Prisma.InputJsonValue,
          },
        }),
      );
    }

    return created;
  } catch (error) {
    await prisma.providerApiKey
      .update({
        where: { id: credential.keyId },
        data: {
          errorCount: { increment: 1 },
          lastError: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        },
      })
      .catch(() => undefined);
    throw error;
  }
}
