import { NextRequest } from "next/server";

import { deleteNineRouterKey } from "@/lib/9router";
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
    const result = await deleteNineRouterKey(id);

    await auditLog({
      userId: user.id,
      action: "9router.key.delete",
      entityType: "ProviderApiKey",
      entityId: id,
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
