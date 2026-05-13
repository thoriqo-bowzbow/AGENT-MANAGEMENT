import { NextRequest } from "next/server";

import { auditLog } from "@/lib/audit";
import { handleApi } from "@/lib/api-helpers";
import { requireUserFromRequest } from "@/lib/auth";
import { createHandoffExport } from "@/lib/export/handoff";
import { getIpAddress } from "@/lib/utils";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const result = await createHandoffExport(user.id);

    await auditLog({
      userId: user.id,
      action: "export.handoff.create",
      entityType: "Project",
      metadata: { path: result.path },
      ipAddress: getIpAddress(request),
    });

    return Response.json(result, { status: 201 });
  });
}
