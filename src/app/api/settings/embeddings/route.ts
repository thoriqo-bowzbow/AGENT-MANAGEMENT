import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { getEmbeddingStatus, updateEmbeddingSettings } from "@/lib/ai/embeddings";
import { handleApi, readJson } from "@/lib/api-helpers";
import { embeddingSettingsSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    return Response.json(await getEmbeddingStatus());
  });
}

export async function PATCH(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const body = embeddingSettingsSchema.parse(await readJson(request, {}));
    await updateEmbeddingSettings(body);
    return Response.json(await getEmbeddingStatus());
  });
}
