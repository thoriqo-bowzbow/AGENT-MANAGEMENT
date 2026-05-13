import { NextRequest } from "next/server";

import { setActiveNineRouterRoute } from "@/lib/9router";
import { auditLog } from "@/lib/audit";
import { handleApi, readJson } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";
import { nineRouterActiveRouteSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = nineRouterActiveRouteSchema.parse(await readJson(request, {}));
    const result = await setActiveNineRouterRoute(body);

    await auditLog({
      userId: user.id,
      action: "9router.route.activate",
      entityType: "Route",
      metadata: {
        providerId: body.providerId,
        modelName: body.modelName,
        keyId: body.keyId,
        routeSlug: body.routeSlug,
      },
      ipAddress: getIpAddress(request),
    });

    return Response.json(result);
  });
}
