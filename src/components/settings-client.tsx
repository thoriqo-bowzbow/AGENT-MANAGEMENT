"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, TestTube2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EmbeddingStatus = {
  configured: boolean;
  modelName: string;
  error?: string;
  gateway: null | {
    providerName: string;
    baseUrl: string;
    keyLabel: string;
    keyLast4: string;
  };
};

export function SettingsClient() {
  const [embedding, setEmbedding] = useState<EmbeddingStatus | null>(null);
  const [modelName, setModelName] = useState("text-embedding-3-small");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEmbeddingSettings() {
    const response = await fetch("/api/settings/embeddings");
    if (response.ok) {
      const data = (await response.json()) as EmbeddingStatus;
      setEmbedding(data);
      setModelName(data.modelName);
    }
  }

  useEffect(() => {
    loadEmbeddingSettings();
  }, []);

  async function saveEmbeddingSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/settings/embeddings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelName }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus(data.error || "Gagal menyimpan setting embedding");
      return;
    }

    setEmbedding(data);
    setStatus("Setting embedding tersimpan.");
  }

  async function testEmbedding() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/embeddings/test", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus(data.error || "Test embedding gagal");
      await loadEmbeddingSettings();
      return;
    }

    setStatus(`Embedding OK: ${data.modelName}, ${data.dimensions} dimensi, ${data.latencyMs}ms.`);
    await loadEmbeddingSettings();
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Security</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Settings</h2>
          <p className="mt-2 text-sm text-slate-400">
            Safe Mode aktif secara default. Embeddings memakai gateway 9Router aktif, bukan API key provider asli.
          </p>
        </div>

        <Card className="p-5">
          <h3 className="font-medium text-white">Local runtime</h3>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Database</p>
              <p className="mt-1 text-slate-100">PostgreSQL via Docker Compose</p>
            </div>
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Secret storage</p>
              <p className="mt-1 text-slate-100">AES-256-GCM encrypted at rest</p>
            </div>
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Session</p>
              <p className="mt-1 text-slate-100">Owner-only local auth cookie</p>
            </div>
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Risky actions</p>
              <p className="mt-1 text-slate-100">Approval gates planned before tool execution</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">9Router embeddings</p>
            <h3 className="mt-1 font-semibold text-white">Document + memory retrieval</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Riqo memakai endpoint aktif 9Router untuk POST /v1/embeddings. Kalau model embedding belum tersedia,
              chat tetap jalan dan retrieval otomatis fallback ke keyword.
            </p>
          </div>

          <form onSubmit={saveEmbeddingSettings} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Embedding model</span>
              <Input value={modelName} onChange={(event) => setModelName(event.target.value)} />
            </label>
            <Button disabled={busy}>
              <Save size={16} />
              Save
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={testEmbedding}>
              <TestTube2 size={16} />
              Test embedding
            </Button>
          </form>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Gateway</p>
              <p className="mt-1 text-slate-100">
                {embedding?.gateway ? `${embedding.gateway.providerName} / ${embedding.gateway.baseUrl}` : "Belum siap"}
              </p>
            </div>
            <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
              <p className="text-slate-500">Gateway key</p>
              <p className="mt-1 text-slate-100">
                {embedding?.gateway ? `${embedding.gateway.keyLabel} ****${embedding.gateway.keyLast4}` : "Tidak tampil"}
              </p>
            </div>
          </div>

          {status || embedding?.error ? (
            <div className="mt-4 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {status || embedding?.error}
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
