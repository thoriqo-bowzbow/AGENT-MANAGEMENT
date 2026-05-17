"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type GoogleAccount = {
  id: string;
  email: string;
  displayName: string | null;
  picture: string | null;
  createdAt: string;
};

export function GoogleWorkspaceClient() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function loadAccounts() {
    try {
      const response = await fetch("/api/google/accounts");
      const data = await response.json();
      if (data.ok) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Failed to load google accounts", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function connectAccount() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/google/auth", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus(data.error || "Gagal membuat URL otorisasi");
        setBusy(false);
      }
    } catch {
      setStatus("Gagal menghubungi server");
      setBusy(false);
    }
  }

  async function disconnectAccount(email: string) {
    if (!window.confirm(`Putus koneksi akun ${email}?`)) return;
    
    setBusy(true);
    try {
      const response = await fetch(`/api/google/accounts?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await loadAccounts();
        setStatus(`Akun ${email} dicabut.`);
      } else {
        const data = await response.json();
        setStatus(data.error || "Gagal mencabut akun");
      }
    } catch {
      setStatus("Gagal menghubungi server");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Connected Accounts</h3>
          <p className="mt-1 text-sm text-slate-400">
            Hubungkan akun Google untuk akses Drive, Gmail, dan Calendar.
          </p>
        </div>
        <Button onClick={connectAccount} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          Connect Google
        </Button>
      </div>

      {status ? (
        <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          {status}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {account.picture ? (
                <Image
                  src={account.picture}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <Workflow size={20} />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-white truncate">
                  {account.displayName || account.email}
                </p>
                <p className="text-xs text-slate-500 truncate">{account.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-red-400"
              onClick={() => disconnectAccount(account.email)}
              disabled={busy}
            >
              <Trash2 size={16} />
            </Button>
          </Card>
        ))}

        {accounts.length === 0 && (
          <div className="sm:col-span-2 rounded-md border border-dashed border-[#20304A] p-8 text-center text-sm text-slate-500">
            Belum ada akun Google yang terhubung.
          </div>
        )}
      </div>
    </div>
  );
}