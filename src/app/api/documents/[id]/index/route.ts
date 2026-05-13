import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reindexStoredDocument } from "@/lib/documents/indexing";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where: { id, userId: user.id },
    });

    if (!document || !document.storagePath) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const updated = await reindexStoredDocument({ documentId: document.id, userId: user.id });

    await auditLog({
      userId: user.id,
      action: "document.index",
      entityType: "Document",
      entityId: document.id,
      ipAddress: getIpAddress(request),
    });

    return Response.json({ document: updated });
  });
}
