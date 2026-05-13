"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DocumentItem = {
  id: string;
  title: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: string;
  updatedAt: string;
  conversation?: { id: string; title: string } | null;
  metadata?: {
    embeddingStatus?: string;
    embeddingModel?: string;
    embeddingError?: string;
  } | null;
  _count: { chunks: number };
};

type SearchChunk = {
  id: string;
  content: string;
  document: { id: string; title: string; fileName: string; status: string };
  score?: number;
  matchType?: string;
};

export function DocumentsClient() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [chunks, setChunks] = useState<SearchChunk[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadDocuments() {
    const response = await fetch("/api/documents");
    if (response.ok) {
      setDocuments((await response.json()).documents);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setUploading(true);
    setStatus("");
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setUploading(false);

    if (!response.ok) {
      setStatus(data.error || "Upload gagal");
      return;
    }

    setStatus(`${data.documents.length} dokumen diupload, di-chunk, dan embedding dicoba.`);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    await loadDocuments();
  }

  async function searchDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setChunks([]);
      return;
    }

    const response = await fetch("/api/documents/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      setChunks((await response.json()).chunks);
    }
  }

  async function reindexDocument(documentId: string) {
    setReindexing(documentId);
    setStatus("");
    const response = await fetch(`/api/documents/${documentId}/index`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setReindexing(null);

    if (!response.ok) {
      setStatus(data.error || "Reindex dokumen gagal");
      return;
    }

    setStatus("Dokumen berhasil di-reindex.");
    await loadDocuments();
  }

  async function reindexAll() {
    setReindexing("all");
    setStatus("");
    const response = await fetch("/api/documents/reindex-all", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setReindexing(null);

    if (!response.ok) {
      setStatus(data.error || "Reindex semua dokumen gagal");
      return;
    }

    const ok = Array.isArray(data.results) ? data.results.filter((result: { ok: boolean }) => result.ok).length : 0;
    setStatus(`Reindex selesai: ${ok}/${data.results?.length || 0} dokumen OK.`);
    await loadDocuments();
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Phase 3</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Documents</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Upload PDF, DOCX, TXT, MD, CSV, XLSX. Text diekstrak, dipecah menjadi chunks, lalu bisa dipakai sebagai context chat.
          </p>
        </div>

        <Card className="p-5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => uploadFiles(event.target.files)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              {uploading ? "Uploading..." : "Upload documents"}
            </Button>
            <Button type="button" variant="secondary" disabled={reindexing === "all"} onClick={reindexAll}>
              <RefreshCw size={16} />
              {reindexing === "all" ? "Reindexing..." : "Reindex all"}
            </Button>
            <p className="text-sm text-slate-500">Max 20MB per file.</p>
          </div>
          {status ? (
            <div className="mt-4 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {status}
            </div>
          ) : null}
        </Card>

        <form onSubmit={searchDocuments} className="flex gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document chunks..." />
          <Button variant="secondary">
            <Search size={16} />
            Search
          </Button>
        </form>

        {chunks.length ? (
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <Card key={chunk.id} className="p-4">
                <p className="text-sm font-medium text-white">{chunk.document.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                  {chunk.matchType || "match"} {typeof chunk.score === "number" ? `/ score ${chunk.score.toFixed(3)}` : ""}
                </p>
                <p className="mt-2 line-clamp-4 text-sm leading-7 text-slate-400">{chunk.content}</p>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {documents.map((document) => (
            <Card key={document.id} className="p-5">
              <div className="flex items-start gap-3">
                <FileText size={19} className="mt-1 text-cyan-200" />
                <div>
                  <h3 className="font-semibold text-white">{document.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.status} / {document._count.chunks} chunks /{" "}
                    {document.sizeBytes ? `${(document.sizeBytes / 1024).toFixed(1)} KB` : "unknown size"}
                  </p>
                  <p className="mt-1 text-xs text-cyan-100">
                    Embedding: {document.metadata?.embeddingStatus || "UNKNOWN"}
                    {document.metadata?.embeddingModel ? ` / ${document.metadata.embeddingModel}` : ""}
                  </p>
                  {document.metadata?.embeddingError ? (
                    <p className="mt-1 text-xs text-amber-200">Embedding fallback: {document.metadata.embeddingError}</p>
                  ) : null}
                  {document.conversation ? (
                    <p className="mt-1 text-xs text-blue-200">Conversation: {document.conversation.title}</p>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-400">{document.fileName}</p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    size="sm"
                    disabled={reindexing === document.id}
                    onClick={() => reindexDocument(document.id)}
                  >
                    <RefreshCw size={14} />
                    {reindexing === document.id ? "Reindexing..." : "Reindex"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
