import { NextRequest } from "next/server";

import { ApiKeyStatus } from "@/generated/prisma/enums";
import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress, slugify } from "@/lib/utils";
import { createRouteSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const routes = await prisma.route.findMany({
      include: {
        steps: {
          where: { isActive: true, provider: { isActive: true } },
          include: { provider: { include: { apiKeys: { where: { status: ApiKeyStatus.ACTIVE }, take: 1 } } } },
          orderBy: { priority: "asc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return Response.json({ routes });
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = createRouteSchema.parse(await readJson(request, {}));
    const route = await prisma.route.create({
      data: {
        name: body.name,
        slug: slugify(body.slug),
        description: body.description,
      },
    });

    await auditLog({
      userId: user.id,
      action: "route.create",
      entityType: "Route",
      entityId: route.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ route }, { status: 201 });
  });
}
