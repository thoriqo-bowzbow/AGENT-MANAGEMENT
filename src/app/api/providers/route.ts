import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress, slugify } from "@/lib/utils";
import { createProviderSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const providers = await prisma.provider.findMany({
      include: {
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
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        },
        models: { orderBy: { createdAt: "asc" } },
        routeSteps: { include: { route: true }, orderBy: { priority: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({ providers });
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = createProviderSchema.parse(await readJson(request, {}));
    const slug = slugify(body.name);
    const route = body.routeSlug
      ? await prisma.route.findUnique({ where: { slug: body.routeSlug } })
      : await prisma.route.findFirst({ where: { isDefault: true, isActive: true } });

    const provider = await prisma.provider.upsert({
      where: { slug },
      update: {
        name: body.name,
        type: body.type,
        baseUrl: body.baseUrl || null,
        isActive: true,
      },
      create: {
        name: body.name,
        slug,
        type: body.type,
        baseUrl: body.baseUrl || null,
        isActive: true,
      },
    });

    await prisma.aiModel.upsert({
      where: { providerId_name: { providerId: provider.id, name: body.modelName } },
      update: { displayName: body.modelName, isActive: true },
      create: {
        providerId: provider.id,
        name: body.modelName,
        displayName: body.modelName,
      },
    });

    if (route) {
      await prisma.routeStep.upsert({
        where: {
          routeId_providerId_modelName: {
            routeId: route.id,
            providerId: provider.id,
            modelName: body.modelName,
          },
        },
        update: { priority: body.priority, isActive: true },
        create: {
          routeId: route.id,
          providerId: provider.id,
          modelName: body.modelName,
          priority: body.priority,
        },
      });
    }

    await auditLog({
      userId: user.id,
      action: "provider.upsert",
      entityType: "Provider",
      entityId: provider.id,
      metadata: { type: body.type, model: body.modelName },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ provider }, { status: 201 });
  });
}
