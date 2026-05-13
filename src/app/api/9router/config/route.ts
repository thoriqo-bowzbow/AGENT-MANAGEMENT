import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApi, readJson } from "@/lib/api-helpers";
import { getNineRouterGateways, getNineRouterProvider, upsertNineRouterConfig } from "@/lib/9router";
import { getIpAddress } from "@/lib/utils";
import { nineRouterConfigSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const provider = await getNineRouterProvider();
    return Response.json({ provider, ...(await getNineRouterGateways()) });
  });
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = nineRouterConfigSchema.parse(await readJson(request, {}));
    const result = await upsertNineRouterConfig(body);

    await auditLog({
      userId: user.id,
      action: "9router.config.upsert",
      entityType: "Provider",
      metadata: { baseUrl: body.baseUrl, modelName: body.modelName, routeSlug: body.routeSlug },
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
