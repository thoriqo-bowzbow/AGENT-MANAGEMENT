import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi } from '@/lib/api-helpers';
import { getOAuth2Client, getAuthorizationUrl, GOOGLE_WORKSPACE_SCOPES } from '@/lib/google-workspace';

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);

    const config = {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
    };

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      return Response.json(
        { ok: false, error: 'Google OAuth not configured' },
        { status: 400 }
      );
    }

    const client = getOAuth2Client(config);
    const url = getAuthorizationUrl(client, GOOGLE_WORKSPACE_SCOPES);

    return Response.json({ ok: true, url });
  });
}
