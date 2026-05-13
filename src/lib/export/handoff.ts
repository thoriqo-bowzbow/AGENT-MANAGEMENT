import "server-only";

import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

import { prisma } from "@/lib/db";

const EXCLUDED_NAMES = new Set([
  ".git",
  ".next",
  "node_modules",
  "exports",
  "storage",
  "coverage",
  ".env",
  ".env.local",
  ".codex-dev.out.log",
  ".codex-dev.err.log",
  "tsconfig.tsbuildinfo",
  "next-env.d.ts",
]);

function timestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function isExcluded(name: string, sourcePath: string) {
  if (EXCLUDED_NAMES.has(name)) {
    return true;
  }

  return sourcePath.includes(`${path.sep}src${path.sep}generated${path.sep}prisma`);
}

async function copyProjectFiles(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (isExcluded(entry.name, sourcePath)) {
      continue;
    }

    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyProjectFiles(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function buildProjectTree(sourceDir: string, rootDir = sourceDir, depth = 0): Promise<string[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const lines: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (isExcluded(entry.name, sourcePath)) {
      continue;
    }

    const relative = path.relative(rootDir, sourcePath);
    lines.push(`${"  ".repeat(depth)}${entry.isDirectory() ? "[dir] " : ""}${relative}`);

    if (entry.isDirectory() && depth < 5) {
      lines.push(...(await buildProjectTree(sourcePath, rootDir, depth + 1)));
    }
  }

  return lines;
}

async function readTextIfExists(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function collectSafeDatabaseSnapshot(userId: string) {
  const [
    user,
    providers,
    routes,
    conversations,
    memories,
    documents,
    usageLogs,
    auditLogs,
    settings,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    }),
    prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        baseUrl: true,
        isActive: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        apiKeys: {
          select: {
            id: true,
            label: true,
            last4: true,
            status: true,
            priority: true,
            requestCount: true,
            errorCount: true,
            lastUsedAt: true,
            cooldownUntil: true,
            lastError: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        models: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.route.findMany({
      include: {
        steps: { include: { provider: { select: { id: true, name: true, slug: true, baseUrl: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { userId },
      include: {
        route: true,
        messages: { orderBy: { createdAt: "asc" } },
        attachments: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.memory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.document.findMany({
      where: { userId },
      include: { chunks: { orderBy: { index: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.usageLog.findMany({
      where: { userId },
      include: { apiKey: { select: { label: true, last4: true } } },
      orderBy: { startedAt: "desc" },
      take: 300,
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    secretPolicy: "Plain secrets are excluded. Provider/gateway keys are represented only by label and last4.",
    user,
    providers,
    routes,
    conversations,
    memories,
    documents,
    usageLogs,
    auditLogs,
    settings,
  };
}

export async function createHandoffExport(userId: string) {
  const root = process.cwd();
  const exportRoot = path.join(root, "exports", `riqo-handoff-${timestamp()}`);
  const projectTarget = path.join(exportRoot, "project-files");

  await mkdir(exportRoot, { recursive: true });
  await copyProjectFiles(root, projectTarget);

  const tree = await buildProjectTree(root);
  const snapshot = await collectSafeDatabaseSnapshot(userId);
  const readme = await readTextIfExists(path.join(root, "README.md"));
  const envExample = await readTextIfExists(path.join(root, ".env.example"));

  await Promise.all([
    writeFile(path.join(exportRoot, "handoff-data.json"), JSON.stringify(snapshot, null, 2), "utf8"),
    writeFile(path.join(exportRoot, "PROJECT_TREE.txt"), tree.join("\n"), "utf8"),
    writeFile(
      path.join(exportRoot, "README-HANDOFF.md"),
      [
        "# Riqo AI Hub Handoff",
        "",
        `Exported at: ${snapshot.exportedAt}`,
        "",
        "Folder ini dibuat supaya proyek bisa dibuka di IDE/AI agent lain tanpa membawa secret mentah.",
        "",
        "Isi utama:",
        "- `project-files/`: source code, Prisma schema, README, package file, dan konfigurasi aman.",
        "- `handoff-data.json`: snapshot aman database, termasuk conversation history, message metadata, provider/gateway tanpa secret, memory, documents, usage log, dan audit log.",
        "- `PROJECT_TREE.txt`: peta folder agar agent lain cepat orientasi.",
        "",
        "Cara pakai di IDE agent lain:",
        "1. Buka folder `project-files/` sebagai workspace.",
        "2. Baca `README.md`, `.env.example`, dan `handoff-data.json`.",
        "3. Jalankan setup database lokal sesuai README.",
        "4. Masukkan ulang secret di `.env` dan gateway key 9Router dari UI. Secret asli memang tidak ikut diekspor.",
        "5. Beri agent lain konteks: Riqo AI Hub memakai 9Router Gateway sebagai sumber model/combo. Jangan membuat manajemen key provider ganda di Riqo.",
        "",
        "Catatan keamanan:",
        "- `.env`, storage upload, generated build, dan node_modules tidak ikut disalin.",
        "- API key/OAuth token asli tidak ditulis ke file export.",
        "- Conversation history tetap bisa berisi teks yang pernah diketik user, jadi perlakukan folder ini sebagai data pribadi.",
        "",
        readme ? "## README saat export\n\n" + readme : "",
        envExample ? "\n## .env.example saat export\n\n```env\n" + envExample + "\n```" : "",
      ].join("\n"),
      "utf8",
    ),
  ]);

  const stats = await stat(exportRoot);

  return {
    path: exportRoot,
    createdAt: stats.birthtime.toISOString(),
    filesPath: projectTarget,
  };
}
