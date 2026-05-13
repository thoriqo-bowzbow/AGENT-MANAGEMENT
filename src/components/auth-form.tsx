"use client";

import { FormEvent, useState } from "react";
import { Bot, Lock, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  mode: "setup" | "login";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload =
      mode === "setup"
        ? {
            name: String(form.get("name") || ""),
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
          }
        : {
            email: String(form.get("email") || ""),
            password: String(form.get("password") || ""),
          };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Request gagal");
      setLoading(false);
      return;
    }

    window.location.href = "/chat";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111F] px-4 py-10">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <Card className="relative w-full max-w-md p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
            <Bot size={22} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">PROYEK 21</p>
            <h1 className="text-2xl font-semibold text-white">Riqo AI Hub</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "setup" ? (
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <UserRound size={15} /> Nama owner
              </span>
              <Input name="name" minLength={2} required defaultValue="riqo" />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Mail size={15} /> Email
            </span>
            <Input name="email" type="email" required placeholder="riqo@example.com" />
          </label>

          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Lock size={15} /> Password
            </span>
            <Input name="password" type="password" minLength={8} required />
          </label>

          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <Button className="w-full" disabled={loading}>
            {loading ? "Memproses..." : mode === "setup" ? "Buat owner dan masuk" : "Masuk"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
