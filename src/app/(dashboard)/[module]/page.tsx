import { notFound } from "next/navigation";
import { Bot, Brain, Code2, FileText, Globe, History, Plug, Workflow } from "lucide-react";

import { Card } from "@/components/ui/card";
import { GoogleWorkspaceClient } from "@/components/google-workspace-client";

const modules = {
  agents: {
    title: "Agents",
    icon: Bot,
    phase: "Phase 6",
    description: "General autonomous agent dengan planning, tool calling, approval gates, dan audit log.",
  },
  coding: {
    title: "Coding Workspace",
    icon: Code2,
    phase: "Phase 6",
    description: "Project workspace, file edit, command runner, diff viewer, dan persistent task context.",
  },
  "browser-agent": {
    title: "Browser Agent",
    icon: Globe,
    phase: "Phase 6",
    description: "Playwright automation dengan screenshot, step state, Safe Mode, dan approval checkpoint.",
  },
  documents: {
    title: "Documents",
    icon: FileText,
    phase: "Phase 3",
    description: "Upload PDF/DOCX/TXT/CSV/XLSX, extract text, chunking, embedding, dan chat over documents.",
  },
  "google-workspace": {
    title: "Google Workspace",
    icon: Workflow,
    phase: "Phase 4",
    description: "Google OAuth, Gmail, Drive, Calendar, Docs, Sheets dengan confirmation flow.",
  },
  channels: {
    title: "Channels",
    icon: Plug,
    phase: "Phase 5",
    description: "Telegram bot dan WhatsApp Web session sebagai channel tambahan, bukan pengganti web chat.",
  },
  memory: {
    title: "Memory",
    icon: Brain,
    phase: "Phase 3",
    description: "Global, user, project, conversation memory dengan search dan selective prompt injection.",
  },
  logs: {
    title: "Logs / Audit",
    icon: History,
    phase: "Phase 7",
    description: "Audit trail lengkap untuk auth, provider changes, tool calls, approvals, dan risky actions.",
  },
} as const;

type Context = {
  params: Promise<{ module: keyof typeof modules }>;
};

export default async function FutureModulePage(context: Context) {
  const { module } = await context.params;
  const item = modules[module];

  if (!item) {
    notFound();
  }

  const Icon = item.icon;

  // Google Workspace sudah aktif
  if (module === "google-workspace") {
    return (
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{item.phase}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </div>

          <Card className="p-6">
            <GoogleWorkspaceClient />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <Icon size={21} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{item.phase}</p>
              <h2 className="text-2xl font-semibold text-white">{item.title}</h2>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-400">{item.description}</p>
          <div className="mt-5 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Modul ini sengaja belum diaktifkan. Phase 1+2 fokus pada web chat, streaming, provider, encrypted keys, router, fallback, dan usage log.
          </div>
        </Card>
      </div>
    </main>
  );
}
