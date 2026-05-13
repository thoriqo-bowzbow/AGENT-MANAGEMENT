import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getActiveNineRouterCredential } from "@/lib/9router";
import { cosineSimilarity, parseEmbeddingResponse, vectorFromJson } from "@/lib/ai/embedding-utils";
import { prisma } from "@/lib/db";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_SETTINGS_KEY = "embeddings.9router";

export type EmbeddingSettings = {
  modelName: string;
};

export type RankedEmbedding<T> = T & {
  score: number;
  vector: number[];
};

function normalizeEmbeddingSettings(value: unknown): EmbeddingSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const modelName = typeof record.modelName === "string" ? record.modelName.trim() : "";
  return {
    modelName: modelName || DEFAULT_EMBEDDING_MODEL,
  };
}

export async function getEmbeddingSettings() {
  const setting = await prisma.setting.findUnique({ where: { key: EMBEDDING_SETTINGS_KEY } });
  return normalizeEmbeddingSettings(setting?.value);
}

export async function updateEmbeddingSettings(settings: EmbeddingSettings) {
  const normalized = normalizeEmbeddingSettings(settings);
  const saved = await prisma.setting.upsert({
    where: { key: EMBEDDING_SETTINGS_KEY },
    update: { value: normalized as Prisma.InputJsonValue },
    create: { key: EMBEDDING_SETTINGS_KEY, value: normalized as Prisma.InputJsonValue },
  });

  return normalizeEmbeddingSettings(saved.value);
}

export async function getEmbeddingStatus() {
  const settings = await getEmbeddingSettings();

  try {
    const credential = await getActiveNineRouterCredential();
    return {
      configured: true,
      modelName: settings.modelName,
      gateway: {
        providerId: credential.providerId,
        providerName: credential.providerName,
        baseUrl: credential.baseUrl,
        keyId: credential.keyId,
        keyLabel: credential.keyLabel,
        keyLast4: credential.keyLast4,
      },
    };
  } catch (error) {
    return {
      configured: false,
      modelName: settings.modelName,
      error: error instanceof Error ? error.message : String(error),
      gateway: null,
    };
  }
}

export async function embedTexts(inputs: string[], modelName?: string) {
  const normalizedInputs = inputs.map((input) => input.trim()).filter(Boolean);
  if (!normalizedInputs.length) {
    return [];
  }

  const settings = await getEmbeddingSettings();
  const credential = await getActiveNineRouterCredential();
  const startedAt = Date.now();
  const model = (modelName || settings.modelName || DEFAULT_EMBEDDING_MODEL).trim();

  try {
    const response = await fetch(`${credential.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: normalizedInputs,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`9Router embeddings gagal ${response.status}: ${text.slice(0, 300)}`);
    }

    const parsed = parseEmbeddingResponse(await response.json());
    await prisma.providerApiKey.update({
      where: { id: credential.keyId },
      data: { requestCount: { increment: 1 }, lastUsedAt: new Date(), lastError: null },
    });

    return parsed.vectors.map((vector) => ({
      vector,
      providerName: credential.providerName,
      modelName: model,
      dimensions: vector.length,
      latencyMs: Date.now() - startedAt,
      usage: parsed.usage,
      gateway: {
        providerId: credential.providerId,
        providerName: credential.providerName,
        baseUrl: credential.baseUrl,
        keyId: credential.keyId,
        keyLabel: credential.keyLabel,
        keyLast4: credential.keyLast4,
      },
    }));
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

export async function embedText(input: string, modelName?: string) {
  const [embedding] = await embedTexts([input], modelName);
  if (!embedding) {
    throw new Error("Embedding kosong.");
  }
  return embedding;
}

export async function testEmbeddingConfig() {
  const embedding = await embedText("Riqo AI Hub embedding test.");
  return {
    ok: true,
    modelName: embedding.modelName,
    dimensions: embedding.dimensions,
    gateway: embedding.gateway,
    latencyMs: embedding.latencyMs,
  };
}

export function rankByEmbedding<T extends { vectorJson: unknown }>(queryVector: number[], items: T[]) {
  return items
    .map((item) => {
      const vector = vectorFromJson(item.vectorJson);
      if (!vector) {
        return null;
      }

      return {
        ...item,
        vector,
        score: cosineSimilarity(queryVector, vector),
      };
    })
    .filter((item): item is RankedEmbedding<T> => Boolean(item))
    .sort((left, right) => right.score - left.score);
}
