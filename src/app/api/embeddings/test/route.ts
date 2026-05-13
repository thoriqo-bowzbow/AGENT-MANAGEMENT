import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { testEmbeddingConfig } from "@/lib/ai/embeddings";
import { handleApi } from "@/lib/api-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    return Response.json(await testEmbeddingConfig());
  });
}
