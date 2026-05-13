import { BookOpen, CheckCircle2, MessageSquareText, Router, ShieldCheck } from "lucide-react";

import { ManualExportButton } from "@/components/manual-client";
import { Card } from "@/components/ui/card";

const guide = [
  {
    title: "1. Siapkan 9Router",
    items: [
      "Buka 9Router, pastikan endpoint lokal aktif, contoh http://localhost:20128/v1.",
      "Kelola semua API key provider asli di 9Router, bukan di Riqo.",
      "Buat gateway API key di menu Endpoint 9Router. Key inilah yang ditempel ke Riqo.",
    ],
  },
  {
    title: "2. Hubungkan Riqo ke 9Router",
    items: [
      "Masuk ke menu 9Router Gateway.",
      "Tambahkan gateway, endpoint, gateway key, dan combo default.",
      "Klik Sync untuk membaca combo dari 9Router, lalu pilih combo yang dipakai General Main.",
    ],
  },
  {
    title: "3. Chat dari website",
    items: [
      "Masuk ke menu Chat dan pilih route General Main.",
      "Kotak input menampilkan gateway key aktif, combo aktif, dan route yang dipakai.",
      "Balasan assistant menyimpan metadata gateway, combo, model aktual, dan key yang digunakan.",
    ],
  },
  {
    title: "4. Maintenance aman",
    items: [
      "Gunakan Add/Edit/Delete di 9Router Gateway untuk mengatur gateway, key, dan combo yang dikenal Riqo.",
      "Riqo hanya menyimpan secret gateway key 9Router secara terenkripsi dan hanya menampilkan label plus last4.",
      "Usage & Tokens mencatat provider/gateway, combo/model, key label, latency, token estimasi, dan error.",
    ],
  },
  {
    title: "5. Documents + embeddings",
    items: [
      "Masuk Settings, set embedding model 9Router, lalu klik Test embedding.",
      "Upload dokumen di menu Documents. Riqo akan extract text, chunk, lalu mencoba embedding lewat /v1/embeddings 9Router.",
      "Jika model embedding belum tersedia, dokumen tetap bisa dicari dengan fallback keyword. Setelah model siap, klik Reindex.",
    ],
  },
  {
    title: "6. Memory approval",
    items: [
      "Memory manual bisa dibuat dari menu Memory dan langsung di-embed.",
      "Gunakan Suggest from chat untuk membuat usulan memory dari conversation.",
      "Suggestion belum aktif sampai ditekan Approve. Reject membuang suggestion tanpa memengaruhi chat.",
    ],
  },
];

const changelog = [
  "2026-05-12: Phase 1+2 runnable: owner login, dashboard, web chat streaming, history, encrypted key, basic usage log.",
  "2026-05-12: Arah provider disederhanakan: Riqo memakai 9Router Gateway, bukan mengelola API key provider asli.",
  "2026-05-12: 9Router Gateway mendukung tambah/edit/hapus gateway, tambah/hapus/aktifkan gateway key, sync/tambah/hapus combo, dan pilih active combo.",
  "2026-05-12: Chat bubble dan area input menampilkan gateway, combo, actual model, serta gateway key yang dipakai.",
  "2026-05-12: Manual web dan paket handoff ditambahkan untuk memindahkan progres ke IDE/AI agent lain.",
  "2026-05-13: Phase 3 dimulai: Settings embedding 9Router, document reindex dengan vector JSON, semantic retrieval, dan memory suggestion approval flow.",
];

export default function ManualPage() {
  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Buku manual</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Cara Pakai Riqo AI Hub</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Manual ini ikut diperbarui setiap ada perubahan penting. Tujuannya supaya Riqo bisa dipakai sendiri,
            dijual, atau dipindahkan ke agent developer lain tanpa menebak-nebak alur sistem.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="p-4">
            <Router className="text-cyan-200" size={20} />
            <p className="mt-3 font-semibold text-white">9Router sebagai gateway</p>
            <p className="mt-2 text-sm text-slate-500">Provider key asli tetap di 9Router.</p>
          </Card>
          <Card className="p-4">
            <MessageSquareText className="text-blue-200" size={20} />
            <p className="mt-3 font-semibold text-white">Chat utama di web</p>
            <p className="mt-2 text-sm text-slate-500">Streaming, history, metadata model.</p>
          </Card>
          <Card className="p-4">
            <ShieldCheck className="text-emerald-200" size={20} />
            <p className="mt-3 font-semibold text-white">Secret tidak dibuka</p>
            <p className="mt-2 text-sm text-slate-500">Tersimpan terenkripsi, tampil last4 saja.</p>
          </Card>
          <Card className="p-4">
            <BookOpen className="text-purple-200" size={20} />
            <p className="mt-3 font-semibold text-white">Handoff siap</p>
            <p className="mt-2 text-sm text-slate-500">Source dan history bisa diekspor aman.</p>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold text-white">Alur penggunaan</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {guide.map((section) => (
              <div key={section.title} className="rounded-md border border-[#20304A] bg-[#0B1220] p-4">
                <h4 className="font-medium text-cyan-100">{section.title}</h4>
                <div className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <p key={item} className="flex gap-2 text-sm leading-6 text-slate-400">
                      <CheckCircle2 className="mt-1 shrink-0 text-emerald-300" size={14} />
                      <span>{item}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <ManualExportButton />

        <Card className="p-5">
          <h3 className="font-semibold text-white">Development log</h3>
          <div className="mt-3 space-y-2">
            {changelog.map((item) => (
              <p key={item} className="text-sm leading-6 text-slate-400">
                {item}
              </p>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
