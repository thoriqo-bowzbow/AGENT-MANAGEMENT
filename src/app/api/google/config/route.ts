import { NextRequest } from 'next/server';

import { requireUserFromRequest } from '@/lib/auth';
import { handleApi, readJson } from '@/lib/api-helpers';
import {
  getGoogleOAuthConfigStatus,
  saveGoogleOAuthConfig,
} from '@/lib/google-workspace';

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    return Response.json({ ok: true, config: await getGoogleOAuthConfigStatus() });
  });
}

export async function PATCH(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);
    const body = await readJson(request, {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    });

    const status = await saveGoogleOAuthConfig({
      clientId: String(body.clientId || ''),
      clientSecret: String(body.clientSecret || ''),
      redirectUri: String(body.redirectUri || ''),
    });

    return Response.json({ ok: true, config: status });
  });
}