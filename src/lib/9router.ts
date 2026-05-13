import "server-only";

import { ApiKeyStatus, ProviderType } from "@/generated/prisma/enums";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { last4, slugify } from "@/lib/utils";

export const NINE_ROUTER_SLUG = "9router";
export const DEFAULT_9ROUTER_BASE_URL = "http://localhost:20128/v1";
export const DEFAULT_9ROUTER_ROUTE_SLUG = "general-main";

export function normalizeNineRouterBaseUrl(baseUrl: string) {
  return (baseUrl || DEFAULT_9ROUTER_BASE_URL).trim().replace(/\/+$/, "");
}

function isNineRouterSlug(slug: string) {
  return slug === NINE_ROUTER_SLUG || slug.startsWith(`${NINE_ROUTER_SLUG}-`);
}

async function uniqueNineRouterSlug(name: string, id?: string) {
  const base = slugify(name) || "gateway";
  let slug = base === NINE_ROUTER_SLUG || base.startsWith(`${NINE_ROUTER_SLUG}-`) ? base : `${NINE_ROUTER_SLUG}-${base}`;

  if (!id) {
    const existingMain = await prisma.provider.findUnique({ where: { slug: NINE_ROUTER_SLUG } });
    if (!existingMain) {
      slug = NINE_ROUTER_SLUG;
    }
  }

  let candidate = slug;
  let index = 2;
  while (true) {
    const existing = await prisma.provider.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === id) {
      return candidate;
    }
    candidate = `${slug}-${index}`;
    index += 1;
  }
}

async function getOrCreateGeneralRoute(routeSlug = DEFAULT_9ROUTER_ROUTE_SLUG) {
  return prisma.route.upsert({
    where: { slug: routeSlug },
    update: { isActive: true, isDefault: routeSlug === DEFAULT_9ROUTER_ROUTE_SLUG },
    create: {
      name: routeSlug === DEFAULT_9ROUTER_ROUTE_SLUG ? "General Main" : routeSlug,
      slug: routeSlug,
      description: "Main Riqo chat route through a selected 9Router gateway combo.",
      isActive: true,
      isDefault: routeSlug === DEFAULT_9ROUTER_ROUTE_SLUG,
    },
  });
}

function gatewayInclude() {
  return {
    apiKeys: {
      select: {
        id: true,
        label: true,
        last4: true,
        status: true,
        priority: true,
        requestCount: true,
        errorCount: true,
        lastUsedAt: true,
        cooldownUntil: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: [{ status: "asc" as const }, { priority: "asc" as const }, { createdAt: "asc" as const }],
    },
    models: { orderBy: { name: "asc" as const } },
    routeSteps: { include: { route: true }, orderBy: { priority: "asc" as const } },
  };
}

export async function getNineRouterGateways() {
  const [gateways, activeRoute] = await Promise.all([
    prisma.provider.findMany({
      where: {
        type: ProviderType.CUSTOM_OPENAI,
        slug: { startsWith: NINE_ROUTER_SLUG },
      },
      include: gatewayInclude(),
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.route.findFirst({
      where: { slug: DEFAULT_9ROUTER_ROUTE_SLUG, isActive: true },
      include: {
        steps: {
          where: {
            isActive: true,
            provider: {
              type: ProviderType.CUSTOM_OPENAI,
              slug: { startsWith: NINE_ROUTER_SLUG },
            },
          },
          include: {
            provider: {
              include: {
                apiKeys: {
                  where: { status: ApiKeyStatus.ACTIVE },
                  orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    }),
  ]);

  const activeStep = activeRoute?.steps[0];

  return {
    gateways,
    activeRoute: activeRoute
      ? {
          id: activeRoute.id,
          name: activeRoute.name,
          slug: activeRoute.slug,
          providerId: activeStep?.providerId || null,
          providerName: activeStep?.provider.name || null,
          baseUrl: activeStep?.provider.baseUrl || null,
          modelName: activeStep?.modelName || null,
          key: activeStep?.provider.apiKeys[0]
            ? {
                id: activeStep.provider.apiKeys[0].id,
                label: activeStep.provider.apiKeys[0].label,
                last4: activeStep.provider.apiKeys[0].last4,
                requestCount: activeStep.provider.apiKeys[0].requestCount,
                errorCount: activeStep.provider.apiKeys[0].errorCount,
              }
            : null,
        }
      : null,
  };
}

export async function getNineRouterProvider() {
  return prisma.provider.findUnique({
    where: { slug: NINE_ROUTER_SLUG },
    include: gatewayInclude(),
  });
}

export async function upsertNineRouterGateway(input: {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  keyLabel?: string;
  modelName: string;
  makeActive?: boolean;
}) {
  const baseUrl = normalizeNineRouterBaseUrl(input.baseUrl);
  const modelName = input.modelName.trim();
  const name = input.name.trim() || "9Router Gateway";
  const slug = await uniqueNineRouterSlug(name, input.id);

  const provider = input.id
    ? await prisma.provider.update({
        where: { id: input.id },
        data: {
          name,
          slug,
          type: ProviderType.CUSTOM_OPENAI,
          baseUrl,
          isActive: true,
        },
      })
    : await prisma.provider.create({
        data: {
          name,
          slug,
          type: ProviderType.CUSTOM_OPENAI,
          baseUrl,
          isActive: true,
        },
      });

  await prisma.aiModel.upsert({
    where: { providerId_name: { providerId: provider.id, name: modelName } },
    update: { displayName: modelName, isActive: true },
    create: {
      providerId: provider.id,
      name: modelName,
      displayName: modelName,
    },
  });

  if (input.apiKey?.trim()) {
    await addNineRouterKey(provider.id, {
      apiKey: input.apiKey,
      label: input.keyLabel || "gateway-key",
      makeActive: true,
    });
  }

  if (input.makeActive ?? true) {
    await setActiveNineRouterRoute({
      providerId: provider.id,
      modelName,
      routeSlug: DEFAULT_9ROUTER_ROUTE_SLUG,
    });
  }

  return getNineRouterGateways();
}

export async function upsertNineRouterConfig(input: {
  baseUrl: string;
  apiKey?: string;
  modelName: string;
  routeSlug: string;
}) {
  const provider = await getNineRouterProvider();
  return upsertNineRouterGateway({
    id: provider?.id,
    name: "9Router Gateway",
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    keyLabel: "gateway-key",
    modelName: input.modelName,
    makeActive: true,
  });
}

export async function deleteNineRouterGateway(providerId: string) {
  const current = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { routeSteps: { where: { route: { slug: DEFAULT_9ROUTER_ROUTE_SLUG }, isActive: true } } },
  });

  if (!current || !isNineRouterSlug(current.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  const isActiveGateway = current.routeSteps.length > 0;
  if (isActiveGateway) {
    const replacement = await prisma.provider.findFirst({
      where: {
        id: { not: providerId },
        type: ProviderType.CUSTOM_OPENAI,
        slug: { startsWith: NINE_ROUTER_SLUG },
        isActive: true,
        apiKeys: { some: { status: ApiKeyStatus.ACTIVE } },
        models: { some: { isActive: true } },
      },
      include: { models: { where: { isActive: true }, orderBy: { name: "asc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });

    if (!replacement?.models[0]) {
      throw new Error("Gateway aktif belum bisa dihapus karena belum ada gateway pengganti. Tambahkan gateway lain dulu.");
    }

    await setActiveNineRouterRoute({
      providerId: replacement.id,
      modelName: replacement.models[0].name,
    });
  }

  await prisma.provider.delete({ where: { id: providerId } });
  return getNineRouterGateways();
}

export async function setActiveNineRouterRoute(input: {
  providerId: string;
  modelName: string;
  keyId?: string;
  routeSlug?: string;
}) {
  const provider = await prisma.provider.findUnique({
    where: { id: input.providerId },
    include: { apiKeys: { where: { status: ApiKeyStatus.ACTIVE }, take: 1 } },
  });

  if (!provider || !isNineRouterSlug(provider.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  const modelName = input.modelName.trim();
  const route = await getOrCreateGeneralRoute(input.routeSlug || DEFAULT_9ROUTER_ROUTE_SLUG);

  await prisma.aiModel.upsert({
    where: { providerId_name: { providerId: provider.id, name: modelName } },
    update: { displayName: modelName, isActive: true },
    create: {
      providerId: provider.id,
      name: modelName,
      displayName: modelName,
    },
  });

  if (input.keyId) {
    await setActiveNineRouterKey(input.keyId);
  } else if (!provider.apiKeys.length) {
    throw new Error("Gateway ini belum punya gateway key aktif.");
  }

  await prisma.provider.update({
    where: { id: provider.id },
    data: { isActive: true },
  });

  await prisma.routeStep.updateMany({
    where: { routeId: route.id },
    data: { isActive: false },
  });

  await prisma.routeStep.upsert({
    where: {
      routeId_providerId_modelName: {
        routeId: route.id,
        providerId: provider.id,
        modelName,
      },
    },
    update: { priority: 1, isActive: true },
    create: {
      routeId: route.id,
      providerId: provider.id,
      modelName,
      priority: 1,
      isActive: true,
    },
  });

  return getNineRouterGateways();
}

export async function addNineRouterKey(
  providerId: string,
  input: { apiKey: string; label?: string; makeActive?: boolean },
) {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider || !isNineRouterSlug(provider.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  if (input.makeActive ?? true) {
    await prisma.providerApiKey.updateMany({
      where: { providerId },
      data: { status: ApiKeyStatus.DISABLED },
    });
  }

  const key = await prisma.providerApiKey.create({
    data: {
      providerId,
      label: input.label?.trim() || "gateway-key",
      encryptedSecret: encryptSecret(input.apiKey.trim()),
      last4: last4(input.apiKey),
      priority: 1,
      status: input.makeActive ?? true ? ApiKeyStatus.ACTIVE : ApiKeyStatus.DISABLED,
    },
  });

  return key;
}

export async function setActiveNineRouterKey(keyId: string) {
  const key = await prisma.providerApiKey.findUnique({ where: { id: keyId }, include: { provider: true } });
  if (!key || !isNineRouterSlug(key.provider.slug)) {
    throw new Error("Gateway key 9Router tidak ditemukan.");
  }

  await prisma.providerApiKey.updateMany({
    where: { providerId: key.providerId },
    data: { status: ApiKeyStatus.DISABLED },
  });

  await prisma.providerApiKey.update({
    where: { id: keyId },
    data: { status: ApiKeyStatus.ACTIVE, cooldownUntil: null, lastError: null },
  });

  return getNineRouterGateways();
}

export async function deleteNineRouterKey(keyId: string) {
  const key = await prisma.providerApiKey.findUnique({ where: { id: keyId }, include: { provider: true } });
  if (!key || !isNineRouterSlug(key.provider.slug)) {
    throw new Error("Gateway key 9Router tidak ditemukan.");
  }

  const wasActive = key.status === ApiKeyStatus.ACTIVE;
  await prisma.providerApiKey.delete({ where: { id: keyId } });

  if (wasActive) {
    const replacement = await prisma.providerApiKey.findFirst({
      where: { providerId: key.providerId, status: ApiKeyStatus.ACTIVE },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    if (replacement) {
      await prisma.providerApiKey.update({
        where: { id: replacement.id },
        data: { status: ApiKeyStatus.ACTIVE },
      });
    }
  }

  return getNineRouterGateways();
}

export async function addNineRouterModel(providerId: string, modelName: string) {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider || !isNineRouterSlug(provider.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  const trimmed = modelName.trim();
  await prisma.aiModel.upsert({
    where: { providerId_name: { providerId, name: trimmed } },
    update: { displayName: trimmed, isActive: true },
    create: { providerId, name: trimmed, displayName: trimmed },
  });

  return getNineRouterGateways();
}

export async function deleteNineRouterModel(modelId: string) {
  const model = await prisma.aiModel.findUnique({ where: { id: modelId }, include: { provider: true } });
  if (!model || !isNineRouterSlug(model.provider.slug)) {
    throw new Error("Combo 9Router tidak ditemukan.");
  }

  const activeStep = await prisma.routeStep.findFirst({
    where: {
      providerId: model.providerId,
      modelName: model.name,
      isActive: true,
      route: { slug: DEFAULT_9ROUTER_ROUTE_SLUG },
    },
  });

  if (activeStep) {
    throw new Error("Combo sedang dipakai route aktif. Pilih combo lain dulu sebelum menghapus.");
  }

  await prisma.aiModel.delete({ where: { id: modelId } });
  return getNineRouterGateways();
}

export async function syncNineRouterModels(providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      apiKeys: {
        where: { status: ApiKeyStatus.ACTIVE },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
  });

  if (!provider || !isNineRouterSlug(provider.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  if (!provider.baseUrl) {
    throw new Error("Endpoint 9Router belum diset.");
  }

  const apiKey = provider.apiKeys[0];
  const headers: Record<string, string> = {};

  if (apiKey) {
    headers.authorization = `Bearer ${decryptSecret(apiKey.encryptedSecret)}`;
  }

  const response = await fetch(`${normalizeNineRouterBaseUrl(provider.baseUrl)}/models`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`9Router /models gagal ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string; name?: string }> };
  const modelIds = (payload.data || [])
    .map((model) => model.id || model.name)
    .filter((model): model is string => Boolean(model));

  await prisma.aiModel.createMany({
    data: modelIds.map((modelName) => ({
      providerId: provider.id,
      name: modelName,
      displayName: modelName,
    })),
    skipDuplicates: true,
  });

  return modelIds;
}

export async function listNineRouterModels() {
  const provider = await prisma.provider.findUnique({ where: { slug: NINE_ROUTER_SLUG } });
  if (!provider) {
    throw new Error("Gateway 9Router belum dibuat.");
  }

  return syncNineRouterModels(provider.id);
}

export async function testNineRouterGateway(providerId: string, modelName?: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      apiKeys: {
        where: { status: ApiKeyStatus.ACTIVE },
        orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      models: { where: { isActive: true }, orderBy: { name: "asc" }, take: 1 },
    },
  });

  if (!provider || !isNineRouterSlug(provider.slug)) {
    throw new Error("Gateway 9Router tidak ditemukan.");
  }

  const key = provider.apiKeys[0];
  const model = modelName || provider.models[0]?.name;

  if (!key) {
    throw new Error("Gateway ini belum punya gateway key aktif.");
  }

  if (!model) {
    throw new Error("Gateway ini belum punya combo/model.");
  }

  const response = await fetch(`${normalizeNineRouterBaseUrl(provider.baseUrl || DEFAULT_9ROUTER_BASE_URL)}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${decryptSecret(key.encryptedSecret)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply only: OK" }],
      stream: false,
      max_tokens: 8,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Test gateway gagal ${response.status}: ${text.slice(0, 300)}`);
  }

  return { ok: true, model, key: { label: key.label, last4: key.last4 } };
}

export async function getActiveNineRouterCredential(routeSlug = DEFAULT_9ROUTER_ROUTE_SLUG) {
  const activeRoute = await prisma.route.findFirst({
    where: { slug: routeSlug, isActive: true },
    include: {
      steps: {
        where: {
          isActive: true,
          provider: {
            type: ProviderType.CUSTOM_OPENAI,
            slug: { startsWith: NINE_ROUTER_SLUG },
          },
        },
        include: {
          provider: {
            include: {
              apiKeys: {
                where: { status: ApiKeyStatus.ACTIVE },
                orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
  });

  const activeStep = activeRoute?.steps[0];
  const activeKey = activeStep?.provider.apiKeys[0];

  if (activeRoute && activeStep?.provider && activeKey) {
    return {
      providerId: activeStep.provider.id,
      providerName: activeStep.provider.name,
      providerSlug: activeStep.provider.slug,
      baseUrl: normalizeNineRouterBaseUrl(activeStep.provider.baseUrl || DEFAULT_9ROUTER_BASE_URL),
      routeId: activeRoute.id,
      routeName: activeRoute.name,
      routeSlug: activeRoute.slug,
      chatModelName: activeStep.modelName,
      keyId: activeKey.id,
      keyLabel: activeKey.label,
      keyLast4: activeKey.last4,
      apiKey: decryptSecret(activeKey.encryptedSecret),
    };
  }

  const fallbackProvider = await prisma.provider.findFirst({
    where: {
      type: ProviderType.CUSTOM_OPENAI,
      slug: { startsWith: NINE_ROUTER_SLUG },
      isActive: true,
      apiKeys: { some: { status: ApiKeyStatus.ACTIVE } },
    },
    include: {
      apiKeys: {
        where: { status: ApiKeyStatus.ACTIVE },
        orderBy: [{ priority: "asc" }, { lastUsedAt: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      models: { where: { isActive: true }, orderBy: { name: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  const fallbackKey = fallbackProvider?.apiKeys[0];
  if (!fallbackProvider || !fallbackKey) {
    throw new Error("Gateway 9Router aktif belum punya gateway key aktif.");
  }

  return {
    providerId: fallbackProvider.id,
    providerName: fallbackProvider.name,
    providerSlug: fallbackProvider.slug,
    baseUrl: normalizeNineRouterBaseUrl(fallbackProvider.baseUrl || DEFAULT_9ROUTER_BASE_URL),
    routeId: null,
    routeName: null,
    routeSlug: null,
    chatModelName: fallbackProvider.models[0]?.name || null,
    keyId: fallbackKey.id,
    keyLabel: fallbackKey.label,
    keyLast4: fallbackKey.last4,
    apiKey: decryptSecret(fallbackKey.encryptedSecret),
  };
}
