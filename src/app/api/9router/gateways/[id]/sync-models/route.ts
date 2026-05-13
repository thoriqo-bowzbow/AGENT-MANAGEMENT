import { NextRequest } from "next/server";

import { getNineRouterGateways, syncNineRouterModels } from "@/lib/9router";
import { auditLog } from "@/lib/audit";
import { handleApi } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const models = await syncNineRouterModels(id);

    await auditLog({
      userId: user.id,
      action: "9router.combo.sync",
      entityType: "Provider",
      entityId: id,
      metadata: { count: models.length },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ ...(await getNineRouterGateways()), syncedModels: models });
  });
}
