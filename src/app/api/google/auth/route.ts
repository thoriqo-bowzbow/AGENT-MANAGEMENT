import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi, readJson } from '@/lib/api-helpers';
import { getOAuth2Client, exchangeCodeForTokens, storeGoogleAccount, GOOGLE_WORKSPACE_SCOPES } from '@/lib/google-workspace';
import { z } from 'zod';

const googleAuthSchema = z.object({
  code: z.string().min(1, 'Authorization code required'),
});

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const body = googleAuthSchema.parse(await readJson(request, {}));

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
    const tokens = await exchangeCodeForTokens(client, body.code);

    if (!tokens.access_token) {
      return Response.json(
        { ok: false, error: 'Failed to obtain access token' },
        { status: 400 }
      );
    }

    const tokenInfo = await client.getTokenInfo(tokens.access_token);
    const email = tokenInfo.email || 'unknown@google.com';

    const account = await storeGoogleAccount(
      user.id,
      email,
      GOOGLE_WORKSPACE_SCOPES,
      tokens
    );

    return Response.json({
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        scopes: account.scopes,
      },
    });
  });
}