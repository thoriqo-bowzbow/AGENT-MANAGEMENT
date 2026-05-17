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

    const isPlaceholder =
      config.clientId === 'your-google-oauth-client-id' ||
      config.clientSecret === 'your-google-oauth-client-secret' ||
      config.clientId.includes('your-') ||
      config.clientSecret.includes('your-');

    if (!config.clientId || !config.clientSecret || !config.redirectUri || isPlaceholder) {
      return Response.json(
        {
          ok: false,
          error:
            'Google OAuth belum dikonfigurasi. Isi GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET di .env dengan credential asli dari Google Cloud Console.',
        },
        { status: 400 }
      );
    }

    const client = getOAuth2Client(config);
    const url = getAuthorizationUrl(client, GOOGLE_WORKSPACE_SCOPES);

    return Response.json({ ok: true, url });
  });
}
