import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress, last4 } from "@/lib/utils";
import { bulkKeysSchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = bulkKeysSchema.parse(await readJson(request, {}));
    const provider = await prisma.provider.findUnique({ where: { id } });

    if (!provider) {
      return Response.json({ error: "Provider not found" }, { status: 404 });
    }

    const keys = body.keys
      .split(/\r?\n|,/)
      .map((key) => key.trim())
      .filter(Boolean);

    const created = await Promise.all(
      keys.map((key, index) =>
        prisma.providerApiKey.create({
          data: {
            providerId: provider.id,
            label: `${body.labelPrefix}-${index + 1}`,
            encryptedSecret: encryptSecret(key),
            last4: last4(key),
          },
          select: {
            id: true,
            label: true,
            last4: true,
            status: true,
            createdAt: true,
          },
        }),
      ),
    );

    await auditLog({
      userId: user.id,
      action: "provider.keys.bulk_add",
      entityType: "Provider",
      entityId: provider.id,
      metadata: { count: created.length },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ keys: created }, { status: 201 });
  });
}
