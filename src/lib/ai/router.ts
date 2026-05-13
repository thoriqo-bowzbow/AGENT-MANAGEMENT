import "server-only";

import {
  ApiKeyStatus,
  MessageRole,
  ProviderType,
  UsageStatus,
} from "@/generated/prisma/enums";
import { Prisma, type Message } from "@/generated/prisma/client";
import { sortKeyCandidates } from "@/lib/ai/key-selection";
import { geminiAdapter } from "@/lib/ai/providers/gemini";
import { openAiCompatibleAdapter } from "@/lib/ai/providers/openai-compatible";
import type {
  ProviderAdapter,
  RoutedStream,
  RouterChatMessage,
  StreamUsage,
} from "@/lib/ai/types";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { estimateTokens } from "@/lib/utils";

const COOLDOWN_MS = 1000 * 60 * 3;

function adapterFor(type: ProviderType): ProviderAdapter {
  if (type === ProviderType.GEMINI) {
    return geminiAdapter;
  }

  if (
    type === ProviderType.OPENAI_COMPATIBLE ||
    type === ProviderType.OPENROUTER ||
    type === ProviderType.CUSTOM_OPENAI ||
    type === ProviderType.LOCAL_OLLAMA
  ) {
    return openAiCompatibleAdapter;
  }

  throw new Error(`Provider type ${type} is not implemented in Phase 2`);
}

export function toRouterMessages(messages: Message[]): RouterChatMessage[] {
  return messages.map((message) => ({
    role: message.role.toLowerCase() as RouterChatMessage["role"],
    content: message.content,
  }));
}

async function resolveRoute(routeId?: string, routeSlug?: string) {
  const route = await prisma.route.findFirst({
    where: {
      isActive: true,
      ...(routeId ? { id: routeId } : routeSlug ? { slug: routeSlug } : { isDefault: true }),
    },
    include: {
      steps: {
        where: { isActive: true, provider: { isActive: true } },
        include: {
          provider: {
            include: {
              apiKeys: {
                where: {
                  status: ApiKeyStatus.ACTIVE,
                  OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: new Date() } }],
                },
                orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!route) {
    throw new Error("No active AI route is configured");
  }

  return route;
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 800);
  }

  return String(error).slice(0, 800);
}

export async function createRoutedChatStream(input: {
  userId?: string | null;
  conversationId?: string;
  routeId?: string;
  routeSlug?: string;
  messages: RouterChatMessage[];
  signal?: AbortSignal;
}): Promise<RoutedStream> {
  const route = await resolveRoute(input.routeId, input.routeSlug);
  const attemptedErrors: string[] = [];

  for (const step of route.steps) {
    const provider = step.provider;
    const apiKey = sortKeyCandidates(provider.apiKeys)[0];

    if (!apiKey) {
      attemptedErrors.push(`${provider.name}: no active API key`);
      continue;
    }

    const usageLog = await prisma.usageLog.create({
      data: {
        userId: input.userId || undefined,
        providerId: provider.id,
        apiKeyId: apiKey.id,
        routeId: route.id,
        conversationId: input.conversationId,
        providerName: provider.name,
        modelName: step.modelName,
        routeName: route.slug,
        status: UsageStatus.PENDING,
      },
    });

    try {
      const adapter = adapterFor(provider.type);
      const decryptedKey = decryptSecret(apiKey.encryptedSecret);
      const result = await adapter.streamChat({
        provider,
        apiKey: decryptedKey,
        model: step.modelName,
        messages: input.messages,
        signal: input.signal,
      });

      await prisma.providerApiKey.update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
          requestCount: { increment: 1 },
          lastError: null,
          cooldownUntil: null,
        },
      });

      return {
        stream: result.stream,
        attempt: {
          route,
          provider,
          apiKey,
          model: step.modelName,
          usageLogId: usageLog.id,
          usage: result.usage,
        },
        finalize: async (content: string) => {
          const inputTokens =
            result.usage.inputTokens ?? estimateTokens(input.messages.map((m) => m.content).join("\n"));
          const outputTokens = result.usage.outputTokens ?? estimateTokens(content);

          await prisma.usageLog.update({
            where: { id: usageLog.id },
            data: {
              status: UsageStatus.SUCCESS,
              inputTokens,
              outputTokens,
              metadata: {
                configuredModel: step.modelName,
                actualModel: result.usage.actualModel,
                gatewayKeyLabel: apiKey.label,
                gatewayKeyLast4: apiKey.last4,
              },
              latencyMs: Date.now() - usageLog.startedAt.getTime(),
              completedAt: new Date(),
            },
          });
        },
        fail: async (error: unknown) => {
          const message = safeError(error);
          await prisma.usageLog.update({
            where: { id: usageLog.id },
            data: {
              status: UsageStatus.ERROR,
              errorMessage: message,
              latencyMs: Date.now() - usageLog.startedAt.getTime(),
              completedAt: new Date(),
            },
          });
          await prisma.providerApiKey.update({
            where: { id: apiKey.id },
            data: {
              errorCount: { increment: 1 },
              lastError: message,
              cooldownUntil: new Date(Date.now() + COOLDOWN_MS),
            },
          });
        },
      };
    } catch (error) {
      const message = safeError(error);
      attemptedErrors.push(`${provider.name}/${step.modelName}: ${message}`);

      await prisma.usageLog.update({
        where: { id: usageLog.id },
        data: {
          status: UsageStatus.ERROR,
          errorMessage: message,
          latencyMs: Date.now() - usageLog.startedAt.getTime(),
          completedAt: new Date(),
        },
      });

      await prisma.providerApiKey.update({
        where: { id: apiKey.id },
        data: {
          errorCount: { increment: 1 },
          lastError: message,
          cooldownUntil: new Date(Date.now() + COOLDOWN_MS),
        },
      });
    }
  }

  throw new Error(`All route steps failed. ${attemptedErrors.join(" | ")}`);
}

export async function healthCheckProvider(providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      apiKeys: {
        where: { status: ApiKeyStatus.ACTIVE },
        orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      models: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  const key = provider.apiKeys[0];
  const model = provider.models[0]?.name;

  if (!key || !model) {
    throw new Error("Provider needs at least one active key and model");
  }

  await adapterFor(provider.type).healthCheck({
    provider,
    apiKey: decryptSecret(key.encryptedSecret),
    model,
  });
}

export async function getAvailableModels() {
  const models = await prisma.aiModel.findMany({
    where: { isActive: true, provider: { isActive: true } },
    include: { provider: true },
    orderBy: [{ provider: { name: "asc" } }, { name: "asc" }],
  });

  return models.map((model) => ({
    id: model.name,
    object: "model",
    owned_by: model.provider.slug,
    displayName: model.displayName,
  }));
}

export async function persistAssistantMessage(input: {
  conversationId: string;
  content: string;
  providerName?: string;
  modelName?: string;
  usage?: StreamUsage;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: MessageRole.ASSISTANT,
      content: input.content,
      providerName: input.providerName,
      modelName: input.modelName,
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
      metadata: input.metadata,
    },
  });
}
