# AGENTS.md - PROYEK 21

## Project
Nama proyek internal: PROYEK 21  
Nama aplikasi: Riqo AI Hub



## Phase Breakdown

**Phase 1+2: Fondasi (SELESAI)**
- Local web app Next.js App Router.
- First-run owner setup + login lokal.
- Dashboard + Chat utama.
- Conversation sidebar + persisted history.
- Streaming chat response.
- Provider/route foundation.
- API key terenkripsi AES-256-GCM.
- 9Router gateway multi-instance.
- Round-robin key selection.
- Fallback sederhana.
- Usage log dasar.
- Audit/security baseline.
- Internal `/v1/models` + `/v1/chat/completions` endpoints.

**Phase 3 Sprint: Knowledge Layer (SELESAI)**
- Memory CRUD.
- Memory enable/disable.
- Auto-memory suggestion dari conversation.
- Approve/reject suggestion workflow.
- Memory embedding via 9Router.
- Semantic search memory + keyword fallback.
- Document upload PDF, DOCX, TXT, MD, CSV, XLSX.
- Document extraction + chunking + indexing.
- Document semantic search + context injection.
- Embeddings via 9Router `/v1/embeddings`.
- Export handoff untuk transfer ke IDE/agent lain.
- Manual page + development log.

**Phase 4: Google Workspace Integration (AKTIF SEBAGIAN)**
- Google OAuth connect/disconnect.
- Encrypted Google token storage.
- Token refresh helper.
- API client helper untuk Gmail, Drive, Calendar, Docs, Sheets.
- UI `/google-workspace` untuk connected accounts.
- UI setup Google OAuth Client ID/Secret dari `/google-workspace`, disimpan terenkripsi via settings lokal.
- Endpoint config Google OAuth: `GET/PATCH /api/google/config`.
- Belum lengkap: aksi runtime Gmail/Drive/Calendar/Docs/Sheets dari chat/tool layer.

**Phase 5: Channels (ROADMAP, belum runtime aktif)**
- Telegram bot integration.
- WhatsApp bot integration via Baileys/whatsapp-web.js.
- Channel tambahan, bukan pengganti web chat.

**Phase 6: Agents (ROADMAP, belum runtime aktif)**
- General autonomous agent.
- Coding Workspace: file edit, command runner, diff viewer, task context.
- Browser Agent: Playwright automation, screenshot, Safe Mode, approval checkpoint.

**Phase 7: Logs/Audit (ROADMAP lanjutan)**
- Audit trail lengkap untuk auth, provider changes, tool calls, approvals, risky actions.
- Saat ini baru usage log dasar dan audit/security baseline fondasi.

## Prioritas
SELALU GUNAKAN BAHASA INDONESIA, BAIK SEDANG BERIPIKIR MAUPUN MENJELASKAN KE SAYA.. AGAR SAYA TETAP TAHU KAMU SEDANG APA.

Status proyek sudah bergerak melewati prioritas awal Phase 1 + fondasi Phase 2.

Posisi kerja saat ini:
- **Phase aktual: Phase 4 Google Workspace aktif sebagian**; Phase 1+2 dan Phase 3 Sprint sudah selesai (lihat README.md untuk detail lengkap).
- Fitur aktif: web chat, streaming, history, 9Router gateway multi-instance, encrypted keys, usage log, memory CRUD + auto-suggest + semantic search, document upload/extraction/chunking/indexing + semantic search, embeddings via 9Router, internal `/v1` endpoints, export handoff.
- Aktif sebagian: Google Workspace connect/disconnect + token helper + setup OAuth config dari UI.
- Belum aktif: aksi runtime Gmail/Drive/Calendar/Docs/Sheets dari chat/tool layer, Telegram, WhatsApp, Coding Agent, Browser Agent, Full Auto Pilot (menu placeholder sudah ada).
- Prioritas lama tetap jadi fondasi, tapi jangan menganggap proyek masih berhenti di Phase 1/2.
- **Sebelum mulai edit/coding, jalankan full mesin dulu** (postgres, dev server, cek 9Router gateway aktif).
- Setelah pengodingan selesai dan tes CLI berhasil, **JANGAN LUPA CHECK SECARA LIVE DI BROWSER LOKAL**.
- Untuk live check/browser debug lokal, gunakan `http://localhost:9222`.
- Saat live check, benar-benar pastikan fungsi yang dibuat/diedit berjalan normal sebagaimana mestinya, bukan hanya lolos build/test CLI.
- Setiap selesai mengerjakan task, perbarui ingatan kerja di AGENTS.md bila ada perubahan status, keputusan teknis, endpoint penting, atau cara test baru.
- Auto git sync tersedia lagi via `scripts/auto-git-sync.mjs`.
- Command: `npm run auto-sync:once` untuk sekali sync, `npm run auto-sync` untuk watcher, `node scripts/auto-git-sync.mjs --dry-run` untuk simulasi.
- Commit/push manual tetap boleh dipakai untuk task penting agar hasil terkontrol.
- Verifikasi terakhir 2026-05-17: `npm run typecheck`, `npm run lint`, `npm run test` (12/12), dan `npm run build` berhasil; Postgres container healthy di port `5432`; app lokal terbuka sampai halaman login di `http://127.0.0.1:3000`; 9Router lokal `http://localhost:20128/v1/models` belum reachable (`http_code=000`), jadi chat AI runtime belum bisa diverifikasi penuh sampai 9Router dinyalakan.

Jangan lanjut/ubah fitur besar berikut tanpa memastikan fondasi web chat + AI router dasar tetap bisa dites:
- Telegram
- WhatsApp
- Google Workspace
- Memory lanjutan
- Document reader lanjutan
- Coding Agent
- Browser Agent
- Full Auto Pilot

## Wajib
- Website harus bisa dibuka lokal.
- User bisa chat langsung dari website.
- Chat response streaming.
- Conversation history tersimpan.
- Provider AI bisa ditambahkan.
- API key disimpan terenkripsi.
- Round-robin API key dasar berjalan.
- Fallback sederhana berjalan.
- Usage log tercatat.

## Larangan
- Jangan membuat landing page/mockup kosong.
- Jangan hardcode API key/token/secret.
- Jangan log secret penuh.
- Jangan menghapus file penting tanpa alasan jelas.
- Jangan mengubah arsitektur besar tanpa menjelaskan dampaknya.

## Gaya kerja
- Jelaskan file yang diubah.
- Setelah task selesai, berikan command untuk test.
- Jika ada error, debug dari error sebenarnya.
- Prioritaskan aplikasi runnable dibanding fitur yang terlalu luas.