import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { handleApi } from "@/lib/api-helpers";
import { listNineRouterModels } from "@/lib/9router";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const models = await listNineRouterModels();
    return Response.json({ models });
  });
}
