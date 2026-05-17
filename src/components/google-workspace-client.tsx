"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Plus, Save, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type GoogleAccount = {
  id: string;
  email: string;
  displayName: string | null;
  picture: string | null;
  createdAt: string;
};

type GoogleOAuthConfigStatus = {
  configured: boolean;
  clientId: string;
  clientSecretPreview: string;
  redirectUri: string;
};

export function GoogleWorkspaceClient() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [config, setConfig] = useState<GoogleOAuthConfigStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("http://127.0.0.1:3000/api/google/callback");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [status, setStatus] = useState("");

  const loadConfig = useCallback(async () => {
    const response = await fetch("/api/google/config");
    const data = await response.json();

    if (data.ok) {
      setConfig(data.config);
      setClientId(data.config.clientId || "");
      setRedirectUri(data.config.redirectUri || "http://127.0.0.1:3000/api/google/callback");
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/google/accounts");
      const data = await response.json();
      if (data.ok) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Failed to load google accounts", error);
    }
  }, []);

  const loadPage = useCallback(async () => {
    try {
      await Promise.all([loadConfig(), loadAccounts()]);
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadConfig]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingConfig(true);
    setStatus("");

    try {
      const response = await fetch("/api/google/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, redirectUri }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Gagal menyimpan konfigurasi Google OAuth");
        return;
      }

      setConfig(data.config);
      setClientSecret("");
      setStatus("Konfigurasi Google OAuth tersimpan. Sekarang klik Connect Google.");
    } catch {
      setStatus("Gagal menghubungi server");
    } finally {
      setSavingConfig(false);
    }
  }

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
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">Setup Google OAuth</h3>
              {config?.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                  <CheckCircle2 size={14} />
                  Siap connect
                </span>
              ) : (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
                  Perlu diisi
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Untuk pemula: buat OAuth Client di Google Cloud Console, salin Client ID dan Client Secret ke form ini, lalu klik Simpan.
            </p>
          </div>
          <a
            className="inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
          >
            Buka Google Cloud Console
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="rounded-md border border-[#20304A] bg-[#07111F] p-4 text-sm text-slate-300">
          <p className="font-medium text-white">Langkah cepat:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Buat project Google Cloud, aktifkan OAuth consent screen.</li>
            <li>Buat Credentials → OAuth Client ID → Web application.</li>
            <li>
              Tambahkan Authorized redirect URI:
              <code className="ml-1 rounded bg-slate-950 px-1.5 py-0.5 text-cyan-100">{redirectUri}</code>
            </li>
            <li>Simpan Client ID dan Client Secret di form bawah.</li>
          </ol>
        </div>

        <form onSubmit={saveConfig} className="grid gap-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Google OAuth Client ID</span>
            <input
              className="w-full rounded-md border border-[#20304A] bg-[#07111F] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              placeholder="contoh: 1234567890-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Google OAuth Client Secret</span>
            <input
              className="w-full rounded-md border border-[#20304A] bg-[#07111F] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              placeholder={config?.clientSecretPreview || "Paste client secret dari Google"}
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
            />
            {config?.clientSecretPreview ? (
              <p className="text-xs text-slate-500">Secret tersimpan: {config.clientSecretPreview}. Isi lagi hanya jika ingin mengganti.</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Redirect URI</span>
            <input
              className="w-full rounded-md border border-[#20304A] bg-[#07111F] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              value={redirectUri}
              onChange={(event) => setRedirectUri(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Disimpan lokal di database Riqo AI Hub. Jangan bagikan secret ke orang lain.
            </p>
            <Button type="submit" disabled={savingConfig}>
              {savingConfig ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Simpan Konfigurasi
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Connected Accounts</h3>
          <p className="mt-1 text-sm text-slate-400">
            Hubungkan akun Google untuk akses Drive, Gmail, dan Calendar.
          </p>
        </div>
        <Button onClick={connectAccount} disabled={busy || !config?.configured}>
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