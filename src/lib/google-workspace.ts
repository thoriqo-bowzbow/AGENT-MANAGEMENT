/**
 * Google Workspace Integration
 * OAuth2 flow, token management, and API helpers for Gmail, Drive, Calendar, Docs, Sheets
 */

import { google } from 'googleapis';
import { prisma } from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenSet {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope: string;
  token_type: string;
}

/**
 * Get OAuth2 client configured with credentials
 */
export function getOAuth2Client(config: GoogleOAuthConfig) {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

/**
 * Generate authorization URL for user consent
 */
export function getAuthorizationUrl(
  client: ReturnType<typeof getOAuth2Client>,
  scopes: string[]
): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  client: ReturnType<typeof getOAuth2Client>,
  code: string
): Promise<GoogleTokenSet> {
  const { tokens } = await client.getToken(code);
  return tokens as GoogleTokenSet;
}

/**
 * Store Google account and tokens in database
 */
export async function storeGoogleAccount(
  userId: string,
  email: string,
  scopes: string[],
  tokens: GoogleTokenSet
) {
  const encryptedAccessToken = encryptSecret(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : null;

  // Upsert account
  const account = await prisma.googleAccount.upsert({
    where: {
      userId_email: { userId, email },
    },
    create: {
      userId,
      email,
      scopes,
    },
    update: {
      scopes,
    },
  });

  // Store access token
  await prisma.googleToken.create({
    data: {
      googleAccountId: account.id,
      encryptedToken: encryptedAccessToken,
      tokenType: 'access_token',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  // Store refresh token if present
  if (encryptedRefreshToken) {
    await prisma.googleToken.create({
      data: {
        googleAccountId: account.id,
        encryptedToken: encryptedRefreshToken,
        tokenType: 'refresh_token',
        expiresAt: null, // Refresh tokens don't expire
      },
    });
  }

  return account;
}

/**
 * Get valid access token for a Google account, refreshing if needed
 */
export async function getValidAccessToken(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
): Promise<string> {
  const account = await prisma.googleAccount.findUnique({
    where: { userId_email: { userId, email } },
    include: {
      tokens: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!account) {
    throw new Error('Google account not found');
  }

  // Find latest access token
  const accessTokenRecord = account.tokens.find(
    (t) => t.tokenType === 'access_token'
  );

  if (!accessTokenRecord) {
    throw new Error('No access token found');
  }

  // Check if token is still valid
  const now = new Date();
  if (accessTokenRecord.expiresAt && accessTokenRecord.expiresAt > now) {
    return decryptSecret(accessTokenRecord.encryptedToken);
  }

  // Token expired, need to refresh
  const refreshTokenRecord = account.tokens.find(
    (t) => t.tokenType === 'refresh_token'
  );

  if (!refreshTokenRecord) {
    throw new Error('No refresh token available, re-authentication required');
  }

  const client = getOAuth2Client(config);
  client.setCredentials({
    refresh_token: decryptSecret(refreshTokenRecord.encryptedToken),
  });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  // Store new access token
  await prisma.googleToken.create({
    data: {
      googleAccountId: account.id,
      encryptedToken: encryptSecret(credentials.access_token),
      tokenType: 'access_token',
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : null,
    },
  });

  return credentials.access_token;
}

/**
 * Get authenticated Gmail client
 */
export async function getGmailClient(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const accessToken = await getValidAccessToken(userId, email, config);
  const client = getOAuth2Client(config);
  client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: client });
}

/**
 * Get authenticated Drive client
 */
export async function getDriveClient(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const accessToken = await getValidAccessToken(userId, email, config);
  const client = getOAuth2Client(config);
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: client });
}

/**
 * Get authenticated Calendar client
 */
export async function getCalendarClient(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const accessToken = await getValidAccessToken(userId, email, config);
  const client = getOAuth2Client(config);
  client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: client });
}

/**
 * Get authenticated Docs client
 */
export async function getDocsClient(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const accessToken = await getValidAccessToken(userId, email, config);
  const client = getOAuth2Client(config);
  client.setCredentials({ access_token: accessToken });
  return google.docs({ version: 'v1', auth: client });
}

/**
 * Get authenticated Sheets client
 */
export async function getSheetsClient(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const accessToken = await getValidAccessToken(userId, email, config);
  const client = getOAuth2Client(config);
  client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: client });
}

/**
 * Revoke Google account access and delete tokens
 */
export async function revokeGoogleAccount(
  userId: string,
  email: string,
  config: GoogleOAuthConfig
) {
  const account = await prisma.googleAccount.findUnique({
    where: { userId_email: { userId, email } },
    include: { tokens: true },
  });

  if (!account) {
    throw new Error('Google account not found');
  }

  // Revoke tokens with Google
  const refreshToken = account.tokens.find((t) => t.tokenType === 'refresh_token');
  if (refreshToken) {
    const client = getOAuth2Client(config);
    try {
      await client.revokeToken(decryptSecret(refreshToken.encryptedToken));
    } catch (error) {
      console.error('Failed to revoke token with Google:', error);
      // Continue with local deletion even if revocation fails
    }
  }

  // Delete account and tokens from database
  await prisma.googleAccount.delete({
    where: { id: account.id },
  });
}

/**
 * List all Google accounts for a user
 */
export async function listGoogleAccounts(userId: string) {
  return prisma.googleAccount.findMany({
    where: { userId },
    select: {
      id: true,
      email: true,
      scopes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Default scopes for full Workspace access
 */
export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];