import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_COOKIE = "riqo_session";
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(`${token}:${env.sessionSecret()}`).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

async function userFromToken(token?: string) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    }
    return null;
  }

  return session.user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return userFromToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireUserFromRequest(request: NextRequest) {
  const user = await userFromToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return user;
}

export async function requireV1Access(request: NextRequest) {
  const configuredToken = env.internalApiToken();
  const header = request.headers.get("authorization");

  if (configuredToken && header?.startsWith("Bearer ")) {
    const provided = header.slice("Bearer ".length).trim();
    const left = Buffer.from(provided);
    const right = Buffer.from(configuredToken);

    if (left.length === right.length && timingSafeEqual(left, right)) {
      return null;
    }
  }

  return requireUserFromRequest(request);
}

export async function hasOwner() {
  return (await prisma.user.count()) > 0;
}
