import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi } from '@/lib/api-helpers';
import {
  exchangeCodeForTokens,
  getGoogleOAuthConfig,
  getOAuth2Client,
  GOOGLE_WORKSPACE_SCOPES,
  isGoogleOAuthConfigured,
  storeGoogleAccount,
} from '@/lib/google-workspace';

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return Response.json(
        { ok: false, error: 'Authorization code missing' },
        { status: 400 }
      );
    }

    const config = await getGoogleOAuthConfig();

    if (!isGoogleOAuthConfigured(config)) {
      return Response.json(
        { ok: false, error: 'Google OAuth belum dikonfigurasi dari halaman Google Workspace.' },
        { status: 400 }
      );
    }

    const client = getOAuth2Client(config);
    const tokens = await exchangeCodeForTokens(client, code);

    if (!tokens.access_token) {
      return Response.json(
        { ok: false, error: 'Failed to obtain access token' },
        { status: 400 }
      );
    }

    const tokenInfo = await client.getTokenInfo(tokens.access_token);
    const email = tokenInfo.email || 'unknown@google.com';

    await storeGoogleAccount(user.id, email, GOOGLE_WORKSPACE_SCOPES, tokens);

    // Redirect back to Google Workspace page with success message
    return Response.redirect(
      new URL(`/google-workspace?success=true&email=${encodeURIComponent(email)}`, request.url),
      302
    );
  });
}