import { NextRequest } from 'next/server';
import { requireUserFromRequest } from '@/lib/auth';
import { handleApi } from '@/lib/api-helpers';
import { listGoogleAccounts, revokeGoogleAccount } from '@/lib/google-workspace';

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const accounts = await listGoogleAccounts(user.id);
    return Response.json({ ok: true, accounts });
  });
}

export async function DELETE(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return Response.json(
        { ok: false, error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const config = {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
    };

    await revokeGoogleAccount(user.id, email, config);

    return Response.json({ ok: true });
  });
}