"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BookOpen,
  Brain,
  Code2,
  FileText,
  Gauge,
  Globe,
  History,
  KeyRound,
  LogOut,
  MessageSquareText,
  Plug,
  Settings,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/coding", label: "Coding Workspace", icon: Code2 },
  { href: "/browser-agent", label: "Browser Agent", icon: Globe },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/google-workspace", label: "Google Workspace", icon: Workflow },
  { href: "/channels", label: "Channels", icon: Plug },
  { href: "/providers", label: "9Router Gateway", icon: KeyRound },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/usage", label: "Usage & Tokens", icon: Gauge },
  { href: "/manual", label: "Manual", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/logs", label: "Logs / Audit", icon: History },
];

export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen bg-[#07111F] text-slate-100">
      <aside className="hidden w-72 shrink-0 border-r border-[#20304A] bg-[#0B1220] p-4 lg:block">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
            <Bot size={21} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">PROYEK 21</p>
            <h1 className="font-semibold text-white">Riqo AI Hub</h1>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800/70 hover:text-white",
                  active && "bg-blue-500/15 text-blue-100 ring-1 ring-blue-400/30",
                )}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[#20304A] bg-[#07111F]/95 px-4 backdrop-blur md:px-6">
          <div>
            <p className="text-xs text-slate-500">Owner workspace</p>
            <p className="font-medium text-white">{userName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 md:flex">
              <ShieldCheck size={15} />
              Safe Mode ON
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut size={15} />
              Logout
            </Button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
