import { NextRequest } from "next/server";

import { deleteNineRouterModel } from "@/lib/9router";
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
    const result = await deleteNineRouterModel(id);

    await auditLog({
      userId: user.id,
      action: "9router.combo.delete",
      entityType: "AiModel",
      entityId: id,
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
