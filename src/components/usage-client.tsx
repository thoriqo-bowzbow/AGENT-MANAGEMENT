"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, Timer } from "lucide-react";

import { Card } from "@/components/ui/card";

type Summary = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  providers: Record<string, number>;
  models: Record<string, number>;
};

type UsageLog = {
  id: string;
  providerName: string;
  modelName: string;
  status: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  startedAt: string;
  apiKey?: { label: string; last4: string } | null;
};

export function UsageClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);

  useEffect(() => {
    async function load() {
      const [summaryResponse, logsResponse] = await Promise.all([
        fetch("/api/usage/summary"),
        fetch("/api/usage/logs"),
      ]);
      if (summaryResponse.ok) {
        setSummary((await summaryResponse.json()).summary);
      }
      if (logsResponse.ok) {
        setLogs((await logsResponse.json()).logs);
      }
    }
    load();
  }, []);

  const stats = [
    { label: "Requests", value: summary?.requests || 0, icon: Activity },
    { label: "Input tokens", value: summary?.inputTokens || 0, icon: Database },
    { label: "Output tokens", value: summary?.outputTokens || 0, icon: Timer },
    { label: "Errors", value: summary?.errors || 0, icon: AlertTriangle },
  ];

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Telemetry</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Usage & Tokens</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4">
                <Icon size={18} className="text-cyan-200" />
                <p className="mt-4 text-2xl font-semibold text-white">{stat.value.toLocaleString("id-ID")}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-[#20304A] px-4 py-3">
            <h3 className="font-medium text-white">Live usage logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#0B1220] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Tokens</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20304A]">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(log.startedAt).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{log.providerName}</td>
                    <td className="px-4 py-3 text-slate-200">{log.modelName}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.apiKey ? `${log.apiKey.label} ****${log.apiKey.last4}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {(log.inputTokens || 0).toLocaleString("id-ID")} / {(log.outputTokens || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={log.status === "SUCCESS" ? "text-emerald-300" : "text-amber-300"}>
                        {log.status}
                      </span>
                      {log.errorMessage ? <p className="mt-1 line-clamp-1 text-xs text-red-200">{log.errorMessage}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
