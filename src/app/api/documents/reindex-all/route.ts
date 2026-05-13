import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reindexStoredDocument } from "@/lib/documents/indexing";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const documents = await prisma.document.findMany({
      where: { userId: user.id, storagePath: { not: null } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    });

    const results = [];
    for (const document of documents) {
      try {
        const indexed = await reindexStoredDocument({ documentId: document.id, userId: user.id });
        results.push({
          id: document.id,
          title: document.title,
          ok: true,
          chunks: indexed._count.chunks,
          metadata: indexed.metadata,
        });
      } catch (error) {
        results.push({
          id: document.id,
          title: document.title,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await auditLog({
      userId: user.id,
      action: "document.reindex_all",
      entityType: "Document",
      metadata: {
        total: results.length,
        ok: results.filter((result) => result.ok).length,
      },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ results });
  });
}
