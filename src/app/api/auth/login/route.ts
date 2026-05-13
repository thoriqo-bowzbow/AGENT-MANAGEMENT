import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const body = loginSchema.parse(await readJson(request, {}));
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return Response.json({ error: "Email atau password salah" }, { status: 401 });
    }

    await createSession(user.id);
    await auditLog({
      userId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ok: true });
  });
}
