"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Copy,
  FileText,
  MessageSquarePlus,
  RefreshCw,
  SendHorizontal,
  Square,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "SYSTEM" | "USER" | "ASSISTANT" | "TOOL";
  content: string;
  providerName?: string | null;
  modelName?: string | null;
  metadata?: {
    gatewayName?: string;
    comboName?: string;
    actualModel?: string;
    gatewayKeyLabel?: string;
    gatewayKeyLast4?: string;
  } | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  routeId?: string | null;
  messages?: Message[];
};

type RouteOption = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  steps: Array<{
    id: string;
    modelName: string;
    provider: {
      name: string;
      apiKeys?: Array<{ label: string; last4: string }>;
    };
  }>;
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code(props) {
          const { children, className } = props;
          const isBlock = Boolean(className);
          const value = String(children).replace(/\n$/, "");

          if (!isBlock) {
            return <code className="rounded bg-slate-950 px-1 py-0.5 text-cyan-200">{children}</code>;
          }

          return (
            <div className="group relative my-3 overflow-hidden rounded-md border border-[#20304A] bg-slate-950">
              <button
                type="button"
                className="absolute right-2 top-2 hidden rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 group-hover:block"
                onClick={() => navigator.clipboard.writeText(value)}
              >
                <Copy size={12} className="mr-1 inline" />
                Copy
              </button>
              <pre className="overflow-x-auto p-4 text-sm">
                <code className={className}>{value}</code>
              </pre>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeId, setRouteId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== "SYSTEM"),
    [messages],
  );
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === routeId),
    [routes, routeId],
  );
  const selectedStep = selectedRoute?.steps[0];
  const selectedGatewayKey = selectedStep?.provider.apiKeys?.[0];

  async function loadConversations() {
    const response = await fetch("/api/conversations");
    if (response.ok) {
      const data = await response.json();
      setConversations(data.conversations);
      if (!selectedId && data.conversations[0]) {
        setSelectedId(data.conversations[0].id);
      }
    }
  }

  async function loadRoutes() {
    const response = await fetch("/api/routes");
    if (response.ok) {
      const data = await response.json();
      setRoutes(data.routes);
      const defaultRoute = data.routes.find((route: RouteOption) => route.isDefault);
      setRouteId(defaultRoute?.id || data.routes[0]?.id || "");
    }
  }

  async function loadConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`);
    if (response.ok) {
      const data = await response.json();
      setMessages(data.conversation.messages);
      setRouteId(data.conversation.routeId || routeId);
    }
  }

  useEffect(() => {
    loadConversations();
    loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadConversation(selectedId);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function createConversation() {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routeId }),
    });
    if (response.ok) {
      const data = await response.json();
      setSelectedId(data.conversation.id);
      setMessages(data.conversation.messages);
      await loadConversations();
      return data.conversation.id as string;
    }
  }

  async function ensureConversation() {
    if (selectedId) {
      return selectedId;
    }

    return createConversation();
  }

  function friendlyError(message: string) {
    if (/no active api key/i.test(message)) {
      return "Belum ada gateway key 9Router aktif. Buka 9Router Gateway, paste API key lokal dari 9Router Endpoint, lalu coba chat lagi.";
    }

    return message;
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setUploading(true);
    setUploadStatus("");
    setError("");

    try {
      const conversationId = await ensureConversation();
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      if (conversationId) {
        formData.append("conversationId", conversationId);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Upload dokumen gagal");
      }

      setUploadStatus(`${data.documents.length} dokumen masuk ke context conversation.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload dokumen gagal");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    setError("");
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const tempUser: Message = {
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const tempAssistant: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: "ASSISTANT",
      content: "",
      providerName: selectedStep?.provider.name,
      modelName: selectedStep?.modelName,
      metadata: selectedStep
        ? {
            gatewayName: selectedStep.provider.name,
            comboName: selectedStep.modelName,
            actualModel: selectedStep.modelName,
            gatewayKeyLabel: selectedGatewayKey?.label,
            gatewayKeyLast4: selectedGatewayKey?.last4,
          }
        : undefined,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, tempUser, tempAssistant]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId || undefined, message, routeId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Chat request gagal");
      }

      const conversationId = response.headers.get("x-conversation-id");
      if (conversationId && !selectedId) {
        setSelectedId(conversationId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item) =>
            item.id === tempAssistant.id ? { ...item, content: item.content + chunk } : item,
          ),
        );
      }

      await loadConversations();
      if (conversationId) {
        await loadConversation(conversationId);
      } else if (selectedId) {
        await loadConversation(selectedId);
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError(caught instanceof Error ? caught.message : "Chat gagal");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-80 shrink-0 border-r border-[#20304A] bg-[#081421] p-4 md:block">
        <Button className="mb-4 w-full" onClick={createConversation}>
          <MessageSquarePlus size={16} />
          New conversation
        </Button>
        <div className="space-y-2 overflow-y-auto">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedId(conversation.id)}
              className={cn(
                "w-full rounded-md border border-transparent px-3 py-3 text-left transition hover:border-slate-700 hover:bg-slate-900/70",
                selectedId === conversation.id && "border-blue-400/40 bg-blue-500/10",
              )}
            >
              <p className="line-clamp-1 text-sm font-medium text-slate-100">{conversation.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(conversation.updatedAt).toLocaleString("id-ID")}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[#20304A] bg-[#07111F] px-4 py-3">
          <div>
            <h2 className="font-semibold text-white">Chat</h2>
            <p className="text-xs text-slate-500">
              Streaming via {selectedStep?.provider.name || "9Router Gateway"} / {selectedStep?.modelName || "belum ada combo"}
            </p>
          </div>
          <div className="w-64">
            <Select value={routeId} onChange={(event) => setRouteId(event.target.value)}>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {visibleMessages.length === 0 ? (
              <div className="rounded-lg border border-[#20304A] bg-[#101B2D]/70 p-6">
                <p className="text-lg font-semibold text-white">Mulai chat langsung dari website.</p>
                <p className="mt-2 text-sm text-slate-400">
                  Tambahkan gateway 9Router dulu, pilih combo, lalu kirim pesan di sini. Response akan streaming dan history tersimpan.
                </p>
              </div>
            ) : null}

            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-lg border px-4 py-3 text-sm leading-7",
                  message.role === "USER"
                    ? "ml-auto border-blue-400/40 bg-blue-500/15 text-blue-50"
                    : "mr-auto border-[#20304A] bg-[#101B2D] text-slate-100",
                )}
              >
                <MarkdownMessage content={message.content || (loading ? "..." : "")} />
                {message.providerName || message.modelName ? (
                  <div className="mt-3 space-y-1 border-t border-slate-700/60 pt-2 text-xs text-slate-500">
                    <p>
                      Gateway: {message.metadata?.gatewayName || message.providerName || "9Router"} / Combo:{" "}
                      {message.metadata?.comboName || message.modelName || "-"}
                    </p>
                    <p>
                      Model: {message.metadata?.actualModel || message.modelName || "-"}
                      {message.metadata?.gatewayKeyLabel ? (
                        <>
                          {" "}
                          / Key: {message.metadata.gatewayKeyLabel} ****{message.metadata.gatewayKeyLast4}
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form onSubmit={sendMessage} className="border-t border-[#20304A] bg-[#07111F] p-4">
          <div className="mx-auto max-w-4xl">
            {error ? (
              <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {friendlyError(error)}
                {/no active api key/i.test(error) ? (
                  <Link href="/providers" className="ml-2 font-medium text-cyan-200 underline underline-offset-4">
                    Setup 9Router
                  </Link>
                ) : null}
              </div>
            ) : null}
            {uploadStatus ? (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                <FileText size={15} />
                {uploadStatus}
              </div>
            ) : null}
            <div className="mb-3 flex flex-col gap-2 rounded-md border border-[#20304A] bg-[#0B1220] px-3 py-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Active route: <span className="text-slate-100">{selectedRoute?.name || "General Main"}</span> /{" "}
                <span className="text-cyan-100">{selectedStep?.modelName || "combo belum dipilih"}</span>
              </span>
              <span>
                Gateway key:{" "}
                {selectedGatewayKey ? (
                  <span className="text-slate-200">
                    {selectedGatewayKey.label} ****{selectedGatewayKey.last4}
                  </span>
                ) : (
                  <span className="text-amber-100">belum aktif</span>
                )}
              </span>
            </div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => uploadFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
              </Button>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Tulis pesan untuk Riqo AI Hub..."
                className="max-h-44 min-h-14"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {loading ? (
                <Button type="button" variant="danger" size="icon" onClick={() => abortRef.current?.abort()}>
                  <Square size={16} />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()}>
                  <SendHorizontal size={17} />
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                Enter untuk kirim, Shift+Enter untuk baris baru. Upload PDF/DOCX/TXT/CSV/XLSX bisa dipakai sebagai context.
              </span>
              <button type="button" className="flex items-center gap-1 hover:text-slate-300" onClick={loadConversations}>
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
