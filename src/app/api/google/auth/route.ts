import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi } from '@/lib/api-helpers';
import {
  getAuthorizationUrl,
  getGoogleOAuthConfig,
  getOAuth2Client,
  GOOGLE_WORKSPACE_SCOPES,
  isGoogleOAuthConfigured,
} from '@/lib/google-workspace';

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    await requireUserFromRequest(request);

    const config = await getGoogleOAuthConfig();

    if (!isGoogleOAuthConfigured(config)) {
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
