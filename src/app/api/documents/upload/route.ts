import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { requireUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { indexDocumentBuffer } from "@/lib/documents/indexing";
import { safeStorageName } from "@/lib/documents/extract";
import { handleApi } from "@/lib/api-helpers";
import { getIpAddress } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const conversationId = String(formData.get("conversationId") || "") || undefined;

    if (!files.length) {
      return Response.json({ error: "No files uploaded" }, { status: 422 });
    }

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
      if (!conversation) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    const uploadDir = path.join(process.cwd(), "storage", "uploads", user.id);
    await mkdir(uploadDir, { recursive: true });

    const documents = [];

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return Response.json({ error: `${file.name} is larger than 20MB` }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const storedName = safeStorageName(file.name);
      const storagePath = path.join(uploadDir, storedName);
      await writeFile(storagePath, buffer);

      const document = await prisma.document.create({
        data: {
          userId: user.id,
          conversationId,
          title: file.name,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          storagePath,
          status: "UPLOADED",
          metadata: { uploadSource: "web" },
        },
      });

      documents.push(
        await indexDocumentBuffer({
          documentId: document.id,
          buffer,
          fileName: file.name,
          mimeType: file.type,
        }),
      );
    }

    await auditLog({
      userId: user.id,
      action: "document.upload",
      entityType: "Document",
      metadata: { count: documents.length, conversationId },
      ipAddress: getIpAddress(request),
    });

    return Response.json({ documents }, { status: 201 });
  });
}
