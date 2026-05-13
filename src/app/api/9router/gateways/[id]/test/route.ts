import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { handleApi, readJson } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { testNineRouterGateway } from "@/lib/9router";
import { getIpAddress } from "@/lib/utils";
import { nineRouterModelSchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = nineRouterModelSchema.partial().parse(await readJson(request, {}));
    const result = await testNineRouterGateway(id, body.modelName);

    await auditLog({
      userId: user.id,
      action: "9router.gateway.test",
      entityType: "Provider",
      entityId: id,
      metadata: result,
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
