import { NextRequest } from "next/server";

import { deleteNineRouterGateway } from "@/lib/9router";
import { auditLog } from "@/lib/audit";
import { handleApi } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const result = await deleteNineRouterGateway(id);

    await auditLog({
      userId: user.id,
      action: "9router.gateway.delete",
      entityType: "Provider",
      entityId: id,
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
