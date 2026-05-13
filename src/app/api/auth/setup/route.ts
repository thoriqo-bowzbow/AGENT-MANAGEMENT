import { NextRequest } from "next/server";

import { createSession, hashPassword, hasOwner } from "@/lib/auth";
import { ensureDefaultSystem } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { setupSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import { getIpAddress } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    if (await hasOwner()) {
      return Response.json({ error: "Owner account already exists" }, { status: 409 });
    }

    const body = setupSchema.parse(await readJson(request, {}));
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
      },
    });

    await ensureDefaultSystem(user.id);
    await createSession(user.id);
    await auditLog({
      userId: user.id,
      action: "auth.setup_owner",
      entityType: "User",
      entityId: user.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ok: true });
  });
}
