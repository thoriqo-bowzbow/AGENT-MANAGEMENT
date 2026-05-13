"use client";

import { FormEvent, useEffect, useState } from "react";
import { Brain, Check, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Memory = {
  id: string;
  title: string;
  content: string;
  scope: string;
  isEnabled: boolean;
  updatedAt: string;
  conversation?: { id: string; title: string } | null;
  metadata?: {
    embeddingStatus?: string;
    embeddingModel?: string;
    embeddingError?: string;
  } | null;
  score?: number;
  matchType?: string;
};

type Conversation = {
  id: string;
  title: string;
};

type MemorySuggestion = {
  id: string;
  title: string;
  content: string;
  scope: string;
  reason?: string | null;
  sourceConversation?: { id: string; title: string } | null;
};

export function MemoryClient() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  async function loadMemories() {
    const response = await fetch("/api/memories");
    if (response.ok) {
      setMemories((await response.json()).memories);
    }
  }

  async function loadConversations() {
    const response = await fetch("/api/conversations");
    if (response.ok) {
      const data = await response.json();
      setConversations(data.conversations);
      setSelectedConversationId((current) => current || data.conversations?.[0]?.id || "");
    }
  }

  async function loadSuggestions() {
    const response = await fetch("/api/memories/suggestions");
    if (response.ok) {
      setSuggestions((await response.json()).suggestions);
    }
  }

  useEffect(() => {
    loadMemories();
    loadConversations();
    loadSuggestions();
  }, []);

  async function submitMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") || ""),
      content: String(form.get("content") || ""),
      scope: String(form.get("scope") || "USER"),
    };

    const response = await fetch(editing ? `/api/memories/${editing.id}` : "/api/memories", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(data.error || "Gagal menyimpan memory");
      return;
    }

    event.currentTarget.reset();
    setEditing(null);
    setStatus(editing ? "Memory diperbarui." : "Memory baru tersimpan.");
    await loadMemories();
  }

  async function suggestFromChat() {
    if (!selectedConversationId) {
      setStatus("Pilih conversation dulu untuk membuat suggestion.");
      return;
    }

    setSuggesting(true);
    setStatus("");
    const response = await fetch("/api/memories/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selectedConversationId, limit: 3 }),
    });
    const data = await response.json().catch(() => ({}));
    setSuggesting(false);

    if (!response.ok) {
      setStatus(data.error || "Gagal membuat memory suggestion");
      return;
    }

    setStatus(`${data.suggestions.length} memory suggestion dibuat. Approve dulu sebelum aktif.`);
    await loadSuggestions();
  }

  async function approveSuggestion(suggestion: MemorySuggestion) {
    const response = await fetch(`/api/memories/suggestions/${suggestion.id}/approve`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Approve suggestion gagal");
      return;
    }

    setStatus("Suggestion disimpan sebagai memory aktif.");
    await Promise.all([loadSuggestions(), loadMemories()]);
  }

  async function rejectSuggestion(suggestion: MemorySuggestion) {
    const response = await fetch(`/api/memories/suggestions/${suggestion.id}/reject`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Reject suggestion gagal");
      return;
    }

    setStatus("Suggestion ditolak.");
    await loadSuggestions();
  }

  async function toggleMemory(memory: Memory) {
    await fetch(`/api/memories/${memory.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isEnabled: !memory.isEnabled }),
    });
    await loadMemories();
  }

  async function deleteMemory(memory: Memory) {
    await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
    await loadMemories();
  }

  async function searchMemories() {
    if (!query.trim()) {
      await loadMemories();
      return;
    }
    const response = await fetch("/api/memories/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (response.ok) {
      setMemories((await response.json()).memories);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Phase 3</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Memory</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Memory aktif otomatis dicari secara semantic dari chat. Auto memory dibuat sebagai suggestion dan baru aktif setelah kamu approve.
          </p>
        </div>

        <Card className="p-5">
          <form onSubmit={submitMemory} className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Title</span>
              <Input name="title" defaultValue={editing?.title} placeholder="Preferensi bahasa" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Scope</span>
              <Select name="scope" defaultValue={editing?.scope || "USER"}>
                <option value="USER">User</option>
                <option value="GLOBAL">Global</option>
              </Select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-slate-300">Content</span>
              <Textarea
                name="content"
                defaultValue={editing?.content}
                placeholder="Riqo suka jawaban bahasa Indonesia yang praktis dan step-by-step."
                required
              />
            </label>
            <div className="flex gap-2 md:col-span-2">
              <Button>
                <Plus size={16} />
                {editing ? "Update memory" : "Add memory"}
              </Button>
              {editing ? (
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        {status ? (
          <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {status}
          </div>
        ) : null}

        <Card className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 space-y-2">
              <span className="text-sm text-slate-300">Suggest memory dari conversation</span>
              <Select value={selectedConversationId} onChange={(event) => setSelectedConversationId(event.target.value)}>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="button" disabled={suggesting || !selectedConversationId} onClick={suggestFromChat}>
              <Sparkles size={16} />
              {suggesting ? "Menganalisis..." : "Suggest from chat"}
            </Button>
          </div>
          {suggestions.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-md border border-[#20304A] bg-[#0B1220] p-4">
                  <p className="font-semibold text-white">{suggestion.title}</p>
                  <p className="mt-1 text-xs text-cyan-100">
                    {suggestion.scope}
                    {suggestion.sourceConversation ? ` / ${suggestion.sourceConversation.title}` : ""}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{suggestion.content}</p>
                  {suggestion.reason ? <p className="mt-2 text-xs text-slate-500">Reason: {suggestion.reason}</p> : null}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => approveSuggestion(suggestion)}>
                      <Check size={14} />
                      Approve
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => rejectSuggestion(suggestion)}>
                      <X size={14} />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Belum ada pending suggestion.</p>
          )}
        </Card>

        <div className="flex gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memory..." />
          <Button variant="secondary" onClick={searchMemories}>
            <Search size={16} />
            Search
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {memories.map((memory) => (
            <Card key={memory.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Brain size={17} className="text-cyan-200" />
                    <h3 className="font-semibold text-white">{memory.title}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {memory.scope} / {memory.isEnabled ? "enabled" : "disabled"} /{" "}
                    {new Date(memory.updatedAt).toLocaleString("id-ID")}
                  </p>
                  <p className="mt-1 text-xs text-cyan-100">
                    Embedding: {memory.metadata?.embeddingStatus || "UNKNOWN"}
                    {memory.metadata?.embeddingModel ? ` / ${memory.metadata.embeddingModel}` : ""}
                    {typeof memory.score === "number" ? ` / ${memory.matchType} ${memory.score.toFixed(3)}` : ""}
                  </p>
                  {memory.metadata?.embeddingError ? (
                    <p className="mt-1 text-xs text-amber-200">Embedding fallback: {memory.metadata.embeddingError}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="icon" onClick={() => setEditing(memory)}>
                    <Pencil size={15} />
                  </Button>
                  <Button variant="danger" size="icon" onClick={() => deleteMemory(memory)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{memory.content}</p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => toggleMemory(memory)}>
                  {memory.isEnabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
