import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi } from '@/lib/api-helpers';
import { getOAuth2Client, exchangeCodeForTokens, storeGoogleAccount, GOOGLE_WORKSPACE_SCOPES } from '@/lib/google-workspace';

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