"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  KeyRound,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Router,
  Save,
  ServerCog,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type GatewayKey = {
  id: string;
  label: string;
  last4: string;
  status: string;
  requestCount: number;
  errorCount: number;
  lastUsedAt?: string | null;
  cooldownUntil?: string | null;
  lastError?: string | null;
};

type GatewayModel = {
  id: string;
  name: string;
  displayName: string;
  isActive?: boolean;
};

type Gateway = {
  id: string;
  name: string;
  slug: string;
  baseUrl?: string | null;
  isActive: boolean;
  apiKeys: GatewayKey[];
  models: GatewayModel[];
};

type ActiveRoute = {
  id: string;
  name: string;
  slug: string;
  providerId: string | null;
  providerName: string | null;
  baseUrl: string | null;
  modelName: string | null;
  key: {
    id: string;
    label: string;
    last4: string;
    requestCount: number;
    errorCount: number;
  } | null;
} | null;

type ActiveRouteKey = NonNullable<NonNullable<ActiveRoute>["key"]>;

type GatewayResponse = {
  gateways: Gateway[];
  activeRoute: ActiveRoute;
  syncedModels?: string[];
};

const defaultEndpoint = "http://localhost:20128/v1";

function blankForm() {
  return {
    id: "",
    name: "9Router Gateway",
    baseUrl: defaultEndpoint,
    modelName: "everything",
    keyLabel: "gateway-key",
    apiKey: "",
  };
}

function activeKeyFor(gateway: Gateway) {
  return gateway.apiKeys.find((key) => key.status === "ACTIVE") || gateway.apiKeys[0];
}

function KeyLine({ item }: { item: GatewayKey | ActiveRouteKey | null }) {
  if (!item) {
    return null;
  }

  return (
    <span>
      {item.label} <span className="text-slate-500">****{item.last4}</span>
    </span>
  );
}

export function ProvidersClient() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(null);
  const [form, setForm] = useState(blankForm);
  const [selectedCombos, setSelectedCombos] = useState<Record<string, string>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [newKeyLabels, setNewKeyLabels] = useState<Record<string, string>>({});
  const [newCombos, setNewCombos] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");

  const allCombos = useMemo(
    () => Array.from(new Set(gateways.flatMap((gateway) => gateway.models.map((model) => model.name)))).sort(),
    [gateways],
  );

  async function applyGatewayResponse(response: Response) {
    const data = (await response.json().catch(() => ({}))) as GatewayResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Aksi 9Router gagal.");
    }

    setGateways(data.gateways || []);
    setActiveRoute(data.activeRoute || null);
    setSelectedCombos((current) => {
      const next = { ...current };
      for (const gateway of data.gateways || []) {
        if (data.activeRoute?.providerId === gateway.id && data.activeRoute.modelName) {
          next[gateway.id] = data.activeRoute.modelName;
        } else if (!next[gateway.id]) {
          next[gateway.id] = gateway.models[0]?.name || "everything";
        }
      }
      return next;
    });
    return data;
  }

  async function loadGateways() {
    const response = await fetch("/api/9router/gateways");
    if (response.ok) {
      await applyGatewayResponse(response);
    }
  }

  useEffect(() => {
    loadGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(label);
    setStatus("");
    try {
      await action();
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Aksi gagal.");
    } finally {
      setBusy("");
    }
  }

  async function saveGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("save-gateway", async () => {
      const response = await fetch("/api/9router/gateways", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          name: form.name,
          baseUrl: form.baseUrl,
          modelName: form.modelName,
          keyLabel: form.keyLabel,
          apiKey: form.apiKey.trim() || undefined,
          makeActive: true,
        }),
      });
      await applyGatewayResponse(response);
      setForm(blankForm());
      setStatus("Gateway tersimpan. General Main sekarang memakai gateway/combo yang dipilih.");
    });
  }

  function editGateway(gateway: Gateway) {
    setForm({
      id: gateway.id,
      name: gateway.name,
      baseUrl: gateway.baseUrl || defaultEndpoint,
      modelName: activeRoute?.providerId === gateway.id ? activeRoute.modelName || "everything" : gateway.models[0]?.name || "everything",
      keyLabel: activeKeyFor(gateway)?.label || "gateway-key",
      apiKey: "",
    });
    setStatus("Mode edit aktif. Kosongkan gateway key kalau tidak ingin mengganti key.");
  }

  async function deleteGateway(gateway: Gateway) {
    if (!window.confirm(`Hapus gateway "${gateway.name}" dari Riqo? Key provider asli tetap aman di 9Router.`)) {
      return;
    }

    await runAction(`delete-gateway-${gateway.id}`, async () => {
      const response = await fetch(`/api/9router/gateways/${gateway.id}`, { method: "DELETE" });
      await applyGatewayResponse(response);
      setStatus("Gateway dihapus dari Riqo.");
    });
  }

  async function syncGateway(gateway: Gateway) {
    await runAction(`sync-${gateway.id}`, async () => {
      const response = await fetch(`/api/9router/gateways/${gateway.id}/sync-models`, { method: "POST" });
      const data = await applyGatewayResponse(response);
      setStatus(`${data.syncedModels?.length || 0} combo/model dibaca dari ${gateway.name}.`);
    });
  }

  async function testGateway(gateway: Gateway) {
    await runAction(`test-${gateway.id}`, async () => {
      const response = await fetch(`/api/9router/gateways/${gateway.id}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelName: selectedCombos[gateway.id] || gateway.models[0]?.name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Test gateway gagal.");
      }
      setStatus(`Gateway OK: ${gateway.name} / ${data.model} / ${data.key?.label || "key aktif"}.`);
    });
  }

  async function activateGatewayCombo(gateway: Gateway) {
    await runAction(`activate-${gateway.id}`, async () => {
      const modelName = selectedCombos[gateway.id] || gateway.models[0]?.name || "everything";
      const response = await fetch("/api/9router/routes/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: gateway.id, modelName }),
      });
      await applyGatewayResponse(response);
      setStatus(`Active route: General Main memakai ${gateway.name} / ${modelName}.`);
    });
  }

  async function addKey(gateway: Gateway) {
    const apiKey = newKeys[gateway.id]?.trim();
    if (!apiKey) {
      setStatus("Paste gateway key 9Router dulu.");
      return;
    }

    await runAction(`add-key-${gateway.id}`, async () => {
      const response = await fetch(`/api/9router/gateways/${gateway.id}/keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey,
          label: newKeyLabels[gateway.id]?.trim() || "gateway-key",
          makeActive: true,
        }),
      });
      await applyGatewayResponse(response);
      setNewKeys((current) => ({ ...current, [gateway.id]: "" }));
      setNewKeyLabels((current) => ({ ...current, [gateway.id]: "" }));
      setStatus(`Gateway key baru aktif untuk ${gateway.name}.`);
    });
  }

  async function activateKey(key: GatewayKey) {
    await runAction(`activate-key-${key.id}`, async () => {
      const response = await fetch(`/api/9router/keys/${key.id}/activate`, { method: "POST" });
      await applyGatewayResponse(response);
      setStatus(`Gateway key aktif: ${key.label} ****${key.last4}.`);
    });
  }

  async function deleteKey(key: GatewayKey) {
    if (!window.confirm(`Hapus gateway key "${key.label} ****${key.last4}" dari Riqo?`)) {
      return;
    }

    await runAction(`delete-key-${key.id}`, async () => {
      const response = await fetch(`/api/9router/keys/${key.id}`, { method: "DELETE" });
      await applyGatewayResponse(response);
      setStatus("Gateway key dihapus.");
    });
  }

  async function addCombo(gateway: Gateway) {
    const modelName = newCombos[gateway.id]?.trim();
    if (!modelName) {
      setStatus("Isi nama combo/model dulu.");
      return;
    }

    await runAction(`add-combo-${gateway.id}`, async () => {
      const response = await fetch(`/api/9router/gateways/${gateway.id}/models`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelName }),
      });
      await applyGatewayResponse(response);
      setSelectedCombos((current) => ({ ...current, [gateway.id]: modelName }));
      setNewCombos((current) => ({ ...current, [gateway.id]: "" }));
      setStatus(`Combo ${modelName} ditambahkan ke ${gateway.name}.`);
    });
  }

  async function deleteCombo(model: GatewayModel) {
    if (!window.confirm(`Hapus combo "${model.name}" dari daftar Riqo?`)) {
      return;
    }

    await runAction(`delete-combo-${model.id}`, async () => {
      const response = await fetch(`/api/9router/models/${model.id}`, { method: "DELETE" });
      await applyGatewayResponse(response);
      setStatus("Combo dihapus dari daftar Riqo.");
    });
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">9Router mode</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">9Router Gateways</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Semua key Gemini, OpenAI, Claude, dan provider lain tetap dikelola di 9Router. Riqo hanya menyimpan
              endpoint 9Router, gateway key lokal 9Router, dan nama combo yang ingin dipakai chat.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setForm(blankForm())}>
            <Plus size={16} />
            Add gateway
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5">
            <form onSubmit={saveGateway} className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{form.id ? "Edit 9Router gateway" : "Tambah 9Router gateway"}</h3>
                  <p className="mt-1 text-xs text-slate-500">Satu gateway bisa mewakili satu install 9Router. Boleh lebih dari satu.</p>
                </div>
                {form.id ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(blankForm())}>
                    <X size={15} />
                    Cancel edit
                  </Button>
                ) : null}
              </div>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Nama gateway</span>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Endpoint 9Router</span>
                <Input
                  value={form.baseUrl}
                  onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                  placeholder={defaultEndpoint}
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Combo default General Main</span>
                <Input
                  list="all-nine-router-combos"
                  value={form.modelName}
                  onChange={(event) => setForm({ ...form, modelName: event.target.value })}
                  placeholder="everything atau cx/gpt-5.5"
                  required
                />
                <datalist id="all-nine-router-combos">
                  {allCombos.map((combo) => (
                    <option key={combo} value={combo} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Label gateway key</span>
                <Input value={form.keyLabel} onChange={(event) => setForm({ ...form, keyLabel: event.target.value })} />
              </label>

              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm text-slate-300">Gateway API key dari 9Router</span>
                <Input
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                  type="password"
                  placeholder={form.id ? "Kosongkan kalau tidak ingin mengganti key" : "Paste key dari 9Router Endpoint > API Keys"}
                />
                <p className="text-xs text-slate-500">Riqo tidak pernah menampilkan secret penuh setelah tersimpan.</p>
              </label>

              <div className="lg:col-span-2">
                <Button disabled={busy === "save-gateway"}>
                  {busy === "save-gateway" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save gateway
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Router size={18} className="text-cyan-200" />
              <h3 className="font-semibold text-white">Active route</h3>
            </div>
            {activeRoute?.providerName && activeRoute.modelName ? (
              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-md border border-blue-400/30 bg-blue-500/10 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-200/70">General Main</p>
                  <p className="mt-1 font-semibold text-white">{activeRoute.providerName}</p>
                  <p className="mt-1 break-all text-cyan-100">{activeRoute.modelName}</p>
                </div>
                <div className="rounded-md border border-[#20304A] bg-[#0B1220] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Gateway key dipakai</p>
                  <p className="mt-2 text-slate-200">
                    {activeRoute.key ? <KeyLine item={activeRoute.key} /> : "Belum ada key aktif"}
                  </p>
                </div>
                <p className="break-all text-xs text-slate-500">{activeRoute.baseUrl}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
                Belum ada route aktif. Simpan gateway atau pilih combo dari daftar gateway.
              </div>
            )}
          </Card>
        </div>

        {status ? (
          <div
            className={cn(
              "rounded-md border px-4 py-3 text-sm",
              /gagal|belum|error|hapus combo sedang/i.test(status)
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
            )}
          >
            {status}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {gateways.map((gateway) => {
            const isRouteGateway = activeRoute?.providerId === gateway.id;
            const key = activeKeyFor(gateway);
            const selectedCombo = selectedCombos[gateway.id] || gateway.models[0]?.name || "everything";

            return (
              <Card key={gateway.id} className={cn("p-5", isRouteGateway && "border-blue-400/50 bg-blue-500/5")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ServerCog size={18} className="text-cyan-200" />
                      <h3 className="font-semibold text-white">{gateway.name}</h3>
                      {isRouteGateway ? (
                        <span className="rounded bg-blue-500/20 px-2 py-1 text-[11px] font-medium text-blue-100">
                          ACTIVE ROUTE
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-400">{gateway.baseUrl || defaultEndpoint}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="secondary" size="icon" onClick={() => editGateway(gateway)} title="Edit gateway">
                      <Pencil size={15} />
                    </Button>
                    <Button type="button" variant="danger" size="icon" onClick={() => deleteGateway(gateway)} title="Delete gateway">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
                    <div className="flex items-center gap-2">
                      <Layers3 size={16} className="text-purple-200" />
                      <p className="font-medium text-white">Combo route</p>
                    </div>
                    <Select
                      className="mt-3"
                      value={selectedCombo}
                      onChange={(event) => setSelectedCombos((current) => ({ ...current, [gateway.id]: event.target.value }))}
                    >
                      {gateway.models.length ? null : <option value="everything">everything</option>}
                      {gateway.models.map((model) => (
                        <option key={model.id} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </Select>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => activateGatewayCombo(gateway)}
                        disabled={busy === `activate-${gateway.id}`}
                      >
                        {busy === `activate-${gateway.id}` ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Use combo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => syncGateway(gateway)}
                        disabled={busy === `sync-${gateway.id}`}
                      >
                        {busy === `sync-${gateway.id}` ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        Sync
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => testGateway(gateway)}
                        disabled={busy === `test-${gateway.id}`}
                      >
                        {busy === `test-${gateway.id}` ? <Loader2 className="animate-spin" size={14} /> : <FlaskConical size={14} />}
                        Test
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#20304A] bg-[#0B1220] p-3">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-blue-200" />
                      <p className="font-medium text-white">Gateway key aktif</p>
                    </div>
                    {key ? (
                      <div className="mt-3 rounded-md border border-[#20304A] px-3 py-2 text-sm">
                        <p className="text-slate-200">
                          <KeyLine item={key} />
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <CheckCircle2 size={13} className={key.status === "ACTIVE" ? "text-emerald-300" : "text-slate-500"} />
                          {key.status} / {key.requestCount} req / {key.errorCount} err
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-amber-100">Belum ada key aktif.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Gateway keys</p>
                    <div className="space-y-2">
                      {gateway.apiKeys.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-[#20304A] bg-[#0B1220] px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate text-slate-200">
                              <KeyLine item={item} />
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{item.status} / {item.requestCount} req / {item.errorCount} err</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {item.status !== "ACTIVE" ? (
                              <Button type="button" variant="secondary" size="sm" onClick={() => activateKey(item)}>
                                Use
                              </Button>
                            ) : null}
                            <Button type="button" variant="ghost" size="icon" onClick={() => deleteKey(item)} title="Delete key">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[0.7fr_1fr_auto]">
                      <Input
                        value={newKeyLabels[gateway.id] || ""}
                        onChange={(event) => setNewKeyLabels((current) => ({ ...current, [gateway.id]: event.target.value }))}
                        placeholder="Label"
                      />
                      <Input
                        value={newKeys[gateway.id] || ""}
                        onChange={(event) => setNewKeys((current) => ({ ...current, [gateway.id]: event.target.value }))}
                        type="password"
                        placeholder="Paste gateway key"
                      />
                      <Button type="button" variant="secondary" onClick={() => addKey(gateway)}>
                        <Plus size={15} />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Combos dikenal Riqo</p>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {gateway.models.length ? (
                        gateway.models.map((model) => (
                          <div
                            key={model.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-md border bg-[#0B1220] px-3 py-2 text-sm",
                              isRouteGateway && activeRoute?.modelName === model.name
                                ? "border-blue-400/40 text-blue-100"
                                : "border-[#20304A] text-slate-200",
                            )}
                          >
                            <button
                              type="button"
                              className="min-w-0 truncate text-left hover:text-cyan-100"
                              onClick={() => setSelectedCombos((current) => ({ ...current, [gateway.id]: model.name }))}
                              title={model.name}
                            >
                              {model.name}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCombo(model)}
                              title="Delete combo"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-md border border-dashed border-[#20304A] px-3 py-4 text-sm text-slate-500">
                          Klik Sync untuk membaca combo dari 9Router, atau tambah manual.
                        </p>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={newCombos[gateway.id] || ""}
                        onChange={(event) => setNewCombos((current) => ({ ...current, [gateway.id]: event.target.value }))}
                        placeholder="Nama combo/model, contoh: everything"
                      />
                      <Button type="button" variant="secondary" onClick={() => addCombo(gateway)}>
                        <Plus size={15} />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {!gateways.length ? (
          <Card className="p-6 text-sm text-slate-400">
            Belum ada gateway. Tambahkan endpoint dari 9Router, paste gateway key lokal 9Router, lalu pilih combo
            yang ingin dipakai untuk chat.
          </Card>
        ) : null}
      </div>
    </main>
  );
}
