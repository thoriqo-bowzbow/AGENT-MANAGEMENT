import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function maskSecret(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return "****";
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function last4(secret: string) {
  return secret.trim().slice(-4);
}

export function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "New conversation";
  }

  return compact.length > 58 ? `${compact.slice(0, 58)}...` : compact;
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export function getIpAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
