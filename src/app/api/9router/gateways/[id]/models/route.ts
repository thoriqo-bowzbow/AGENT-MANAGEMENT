import { NextRequest } from "next/server";

import { addNineRouterModel } from "@/lib/9router";
import { auditLog } from "@/lib/audit";
import { handleApi, readJson } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { getIpAddress } from "@/lib/utils";
import { nineRouterModelSchema } from "@/lib/validators";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = nineRouterModelSchema.parse(await readJson(request, {}));
    const result = await addNineRouterModel(id, body.modelName);

    await auditLog({
      userId: user.id,
      action: "9router.combo.create",
      entityType: "AiModel",
      metadata: { providerId: id, modelName: body.modelName },
      ipAddress: getIpAddress(request),
    });

    return Response.json(result, { status: 201 });
  });
}
