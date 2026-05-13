import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getNineRouterGateways, upsertNineRouterGateway } from "@/lib/9router";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";
import { nineRouterGatewaySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    return Response.json(await getNineRouterGateways());
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = nineRouterGatewaySchema.parse(await readJson(request, {}));
    const result = await upsertNineRouterGateway(body);

    await auditLog({
      userId: user.id,
      action: body.id ? "9router.gateway.update" : "9router.gateway.create",
      entityType: "Provider",
      entityId: body.id,
      metadata: {
        name: body.name,
        baseUrl: body.baseUrl,
        modelName: body.modelName,
        hasNewKey: Boolean(body.apiKey?.trim()),
      },
      ipAddress: getIpAddress(request),
    });

    return Response.json(result, { status: body.id ? 200 : 201 });
  });
}
