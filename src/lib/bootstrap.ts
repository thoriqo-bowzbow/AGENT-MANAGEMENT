import "server-only";

import { ProviderType, MemoryScope } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export async function ensureDefaultSystem(userId?: string) {
  const route = await prisma.route.upsert({
    where: { slug: "general-main" },
    update: { isDefault: true, isActive: true },
    create: {
      name: "General Main",
      slug: "general-main",
      description: "Default Riqo chat route through the local 9Router gateway.",
      isDefault: true,
      isActive: true,
    },
  });

  const nineRouter = await prisma.provider.upsert({
    where: { slug: "9router" },
    update: {
      name: "9Router Gateway",
      type: ProviderType.CUSTOM_OPENAI,
      baseUrl: "http://localhost:20128/v1",
      isActive: true,
    },
    create: {
      name: "9Router Gateway",
      slug: "9router",
      type: ProviderType.CUSTOM_OPENAI,
      baseUrl: "http://localhost:20128/v1",
      isActive: true,
    },
  });

  await prisma.aiModel.upsert({
    where: { providerId_name: { providerId: nineRouter.id, name: "everything" } },
    update: { displayName: "everything", isActive: true },
    create: {
      providerId: nineRouter.id,
      name: "everything",
      displayName: "everything",
      supportsStreaming: true,
    },
  });

  await prisma.routeStep.upsert({
    where: {
      routeId_providerId_modelName: {
        routeId: route.id,
        providerId: nineRouter.id,
        modelName: "everything",
      },
    },
    update: { priority: 1, isActive: true },
    create: {
      routeId: route.id,
      providerId: nineRouter.id,
      modelName: "everything",
      priority: 1,
    },
  });

  await prisma.provider.updateMany({
    where: { slug: { in: ["gemini", "openai-compatible"] } },
    data: { isActive: false },
  });

  await prisma.setting.upsert({
    where: { key: "safety" },
    update: {},
    create: {
      key: "safety",
      value: {
        safeMode: true,
        fullAutoPilot: false,
      },
    },
  });

  if (userId) {
    await prisma.memory.createMany({
      data: [
        {
          userId,
          scope: MemoryScope.USER,
          title: "User profile",
          content:
            "User adalah riqo/ethan, IT Support, suka bahasa Indonesia yang praktis dan step-by-step.",
        },
        {
          userId,
          scope: MemoryScope.GLOBAL,
          title: "Security preference",
          content:
            "Jangan pernah meminta user membagikan secret, API key, token, atau credential penuh di chat.",
        },
      ],
      skipDuplicates: true,
    });
  }
}
