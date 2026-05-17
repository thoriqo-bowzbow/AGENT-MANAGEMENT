import { ToolCallStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  getCalendarClient,
  getDriveClient,
  getGmailClient,
  getGoogleOAuthConfig,
  listGoogleAccounts,
} from "@/lib/google-workspace";

type GoogleToolIntent =
  | { kind: "help" }
  | { kind: "accounts" }
  | { kind: "gmailSearch"; query: string; email?: string }
  | { kind: "driveSearch"; query: string; email?: string }
  | { kind: "calendarUpcoming"; email?: string };

function parseArgs(text: string) {
  const args: Record<string, string> = {};
  const rest = text.replace(/--([a-z-]+)=("[^"]+"|'[^']+'|\S+)/gi, (_, key: string, value: string) => {
    args[key] = value.replace(/^["']|["']$/g, "");
    return "";
  });
  return { args, rest: rest.trim() };
}

function firstAccountEmail(accounts: Awaited<ReturnType<typeof listGoogleAccounts>>, email?: string) {
  if (email) return email;
  if (!accounts.length) throw new Error("Belum ada akun Google terhubung. Buka Google Workspace → Connect Google.");
  return accounts[0].email;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("id-ID");
}

export function detectGoogleToolIntent(message: string): GoogleToolIntent | null {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower === "/google" || lower === "/google help") return { kind: "help" };
  if (lower === "/google accounts" || lower.includes("akun google yang terhubung")) return { kind: "accounts" };

  if (lower.startsWith("/google gmail")) {
    const { args, rest } = parseArgs(text.replace(/^\/google\s+gmail/i, ""));
    return { kind: "gmailSearch", query: args.q || rest || "newer_than:7d", email: args.email };
  }

  if (lower.startsWith("/google drive")) {
    const { args, rest } = parseArgs(text.replace(/^\/google\s+drive/i, ""));
    return { kind: "driveSearch", query: args.q || rest || "modifiedTime > '1970-01-01T00:00:00'", email: args.email };
  }

  if (lower.startsWith("/google calendar")) {
    const { args } = parseArgs(text.replace(/^\/google\s+calendar/i, ""));
    return { kind: "calendarUpcoming", email: args.email };
  }

  if (lower.includes("cari email") || lower.includes("search gmail")) {
    return { kind: "gmailSearch", query: text.replace(/cari email|search gmail/gi, "").trim() || "newer_than:7d" };
  }

  if (lower.includes("cari file google drive") || lower.includes("search drive")) {
    return { kind: "driveSearch", query: text.replace(/cari file google drive|search drive/gi, "").trim() || "modifiedTime > '1970-01-01T00:00:00'" };
  }

  if (lower.includes("jadwal google calendar") || lower.includes("agenda google calendar")) {
    return { kind: "calendarUpcoming" };
  }

  return null;
}

export async function runGoogleTool(input: {
  userId: string;
  conversationId: string;
  intent: GoogleToolIntent;
}) {
  const toolCall = await prisma.toolCall.create({
    data: {
      conversationId: input.conversationId,
      toolName: `google.${input.intent.kind}`,
      input: input.intent,
      status: ToolCallStatus.RUNNING,
      riskLevel: "LOW",
    },
  });

  try {
    const output = await executeGoogleTool(input.userId, input.intent);
    await prisma.toolCall.update({
      where: { id: toolCall.id },
      data: { status: ToolCallStatus.SUCCESS, output: { text: output } },
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.toolCall.update({
      where: { id: toolCall.id },
      data: { status: ToolCallStatus.ERROR, output: { error: message } },
    });
    throw error;
  }
}

async function executeGoogleTool(userId: string, intent: GoogleToolIntent) {
  if (intent.kind === "help") {
    return [
      "Google Workspace runtime aktif.",
      "",
      "Perintah:",
      "- `/google accounts` → lihat akun terhubung",
      "- `/google gmail --q=\"from:example newer_than:7d\"` → cari Gmail",
      "- `/google drive --q=\"name contains 'laporan'\"` → cari Drive",
      "- `/google calendar` → lihat agenda mendatang",
      "- Tambah `--email=nama@gmail.com` jika akun lebih dari satu",
      "",
      "Mode aman: aksi sekarang read-only; kirim Gmail/buat event belum dieksekusi otomatis.",
    ].join("\n");
  }

  const accounts = await listGoogleAccounts(userId);

  if (intent.kind === "accounts") {
    if (!accounts.length) return "Belum ada akun Google terhubung. Buka Google Workspace → Connect Google.";
    return ["Akun Google terhubung:", ...accounts.map((account) => `- ${account.email} (${account.scopes.length} scopes)`)].join("\n");
  }

  const config = await getGoogleOAuthConfig();

  if (intent.kind === "gmailSearch") {
    const email = firstAccountEmail(accounts, intent.email);
    const gmail = await getGmailClient(userId, email, config);
    const list = await gmail.users.messages.list({ userId: "me", q: intent.query, maxResults: 5 });
    const messages = list.data.messages || [];
    if (!messages.length) return `Tidak ada email cocok untuk query: ${intent.query}`;

    const rows = await Promise.all(
      messages.map(async (message) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: message.id || "",
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = detail.data.payload?.headers || [];
        const header = (name: string) => headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "-";
        return `- ${header("Subject")}\n  Dari: ${header("From")}\n  Tanggal: ${header("Date")}\n  Snippet: ${detail.data.snippet || "-"}`;
      }),
    );

    return [`Hasil Gmail (${email}) untuk: ${intent.query}`, ...rows].join("\n");
  }

  if (intent.kind === "driveSearch") {
    const email = firstAccountEmail(accounts, intent.email);
    const drive = await getDriveClient(userId, email, config);
    const response = await drive.files.list({
      q: intent.query,
      pageSize: 8,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      orderBy: "modifiedTime desc",
    });
    const files = response.data.files || [];
    if (!files.length) return `Tidak ada file Drive cocok untuk query: ${intent.query}`;

    return [
      `Hasil Drive (${email}) untuk: ${intent.query}`,
      ...files.map((file) => `- ${file.name}\n  Tipe: ${file.mimeType || "-"}\n  Update: ${formatDate(file.modifiedTime)}\n  Link: ${file.webViewLink || "-"}`),
    ].join("\n");
  }

  if (intent.kind === "calendarUpcoming") {
    const email = firstAccountEmail(accounts, intent.email);
    const calendar = await getCalendarClient(userId, email, config);
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 8,
      singleEvents: true,
      orderBy: "startTime",
    });
    const events = response.data.items || [];
    if (!events.length) return `Tidak ada agenda mendatang di Calendar (${email}).`;

    return [
      `Agenda mendatang (${email}):`,
      ...events.map((event) => `- ${event.summary || "(tanpa judul)"}\n  Mulai: ${formatDate(event.start?.dateTime || event.start?.date)}\n  Lokasi: ${event.location || "-"}`),
    ].join("\n");
  }

  return "Perintah Google tidak dikenali.";
}