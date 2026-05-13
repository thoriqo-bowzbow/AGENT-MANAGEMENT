import { NextRequest } from "next/server";

import { addNineRouterKey, getNineRouterGateways } from "@/lib/9router";
import { auditLog } from "@/lib/audit";
import { handleApi, readJson } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";
import { nineRouterKeySchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = nineRouterKeySchema.parse(await readJson(request, {}));
    const key = await addNineRouterKey(id, body);

    await auditLog({
      userId: user.id,
      action: "9router.key.create",
      entityType: "ProviderApiKey",
      entityId: key.id,
      metadata: { providerId: id, label: key.label, last4: key.last4, makeActive: body.makeActive },
      ipAddress: getIpAddress(request),
    });

    return Response.json(await getNineRouterGateways(), { status: 201 });
  });
}
