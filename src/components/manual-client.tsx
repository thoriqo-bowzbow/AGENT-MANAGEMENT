"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ManualExportButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function createExport() {
    setLoading(true);
    setResult("");
    setError("");

    try {
      const response = await fetch("/api/export/handoff", { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Export gagal.");
      }

      setResult(data.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-white">Paket handoff untuk IDE/AI agent lain</p>
          <p className="mt-1 text-sm text-slate-500">
            Membuat folder export berisi source code aman, riwayat percakapan, peta folder, dan snapshot database tanpa secret mentah.
          </p>
        </div>
        <Button type="button" onClick={createExport} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Create handoff
        </Button>
      </div>

      {result ? (
        <div className="mt-3 rounded border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          Export siap di: <span className="break-all font-medium">{result}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
