import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApi, readJson } from "@/lib/api-helpers";
import { suggestMemoriesFromConversation } from "@/lib/memory/suggestions";
import { getIpAddress } from "@/lib/utils";
import { memorySuggestSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = memorySuggestSchema.parse(await readJson(request, {}));
    const suggestions = await suggestMemoriesFromConversation({
      userId: user.id,
      conversationId: body.conversationId,
      limit: body.limit,
    });

    await auditLog({
      userId: user.id,
      action: "memory.suggest",
      entityType: "MemorySuggestion",
      metadata: { conversationId: body.conversationId, count: suggestions.length },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ suggestions }, { status: 201 });
  });
}
