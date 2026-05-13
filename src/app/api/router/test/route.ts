import { NextRequest } from "next/server";

import { createRoutedChatStream } from "@/lib/ai/router";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApi, readJson } from "@/lib/api-helpers";
import { routerTestSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = routerTestSchema.parse(await readJson(request, {}));
    const routed = await createRoutedChatStream({
      userId: user.id,
      routeId: body.routeId,
      messages: [{ role: "user", content: body.prompt }],
      signal: request.signal,
    });

    let content = "";
    for await (const chunk of routed.stream) {
      content += chunk;
    }
    await routed.finalize(content);

    return Response.json({
      ok: true,
      provider: routed.attempt.provider.name,
      model: routed.attempt.model,
      content,
    });
  });
}
