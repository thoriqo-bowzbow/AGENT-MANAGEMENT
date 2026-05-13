import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { healthCheckProvider } from "@/lib/ai/router";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    await healthCheckProvider(id);
    await auditLog({
      userId: user.id,
      action: "provider.test.success",
      entityType: "Provider",
      entityId: id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ok: true });
  });
}
