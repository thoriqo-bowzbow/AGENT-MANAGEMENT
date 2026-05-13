import { NextRequest } from "next/server";

import { clearSession, requireUserFromRequest } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    await clearSession();
    await auditLog({
      userId: user.id,
      action: "auth.logout",
      entityType: "User",
      entityId: user.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ok: true });
  });
}
