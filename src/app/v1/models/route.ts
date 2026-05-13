import { NextRequest } from "next/server";

import { getAvailableModels } from "@/lib/ai/router";
import { requireV1Access } from "@/lib/auth";
import { handleApi } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireV1Access(request);
    const data = await getAvailableModels();
    return Response.json({ object: "list", data });
  });
}
