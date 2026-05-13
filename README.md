# Riqo AI Hub

Riqo AI Hub adalah web app AI pribadi untuk PROYEK 21. Phase 1+2 fokus pada fondasi yang benar-benar bisa dipakai: web chat, streaming response, conversation history, provider management, encrypted multi API key, internal AI Router, round-robin dasar, fallback sederhana, dan usage log.

## Status Phase 1+2 + Phase 3 Sprint

Sudah berfungsi:

- Local web app Next.js App Router.
- First-run owner setup dan login lokal.
- Dashboard navy retro-modern dengan Chat sebagai halaman utama.
- Conversation sidebar dan persisted history.
- Streaming chat dari website lewat internal AI Router.
- 9Router Gateway sebagai jalur AI utama.
- Bisa tambah/edit/hapus lebih dari satu gateway 9Router.
- Gateway API key 9Router disimpan AES-256-GCM dan bisa dipilih per gateway.
- Sync, tambah, hapus, dan pilih model/combo dari 9Router untuk route `General Main`.
- API key asli Gemini/OpenAI/Claude/provider lain tetap dikelola di 9Router, bukan di Riqo.
- Usage logs untuk provider, model, key, token estimate/metadata, latency, dan error.
- Chat bubble menampilkan gateway, combo, actual model, dan gateway key yang dipakai.
- Menu Manual berisi cara pakai dan development log.
- Export handoff membuat paket aman untuk memindahkan source, history, dan snapshot proyek ke IDE/AI agent lain.
- Endpoint internal: `/v1/chat/completions` dan `/v1/models`.
- Memory CRUD dengan enable/disable, embedding status, semantic search, dan fallback keyword.
- Auto-memory suggestion dari conversation dengan approve/reject sebelum aktif.
- Document upload untuk PDF, DOCX, TXT, MD, CSV, XLSX.
- Document extraction, chunking, indexing ulang, semantic search, dan context injection ke chat.
- Embeddings lewat 9Router `/v1/embeddings`, default model `text-embedding-3-small`.
- Vector disimpan sementara di `Embedding.vectorJson`; pgvector masih roadmap optimasi berikutnya.
- Upload dokumen langsung dari Chat untuk conversation context.

Belum diaktifkan di Phase 1+2:

- Google Workspace, Telegram, WhatsApp, Coding Agent, Browser Agent, dan Full Auto Pilot. Menu sudah ada sebagai placeholder jelas agar roadmap tetap rapi.

## Windows 11 Local Setup

1. Pastikan Docker Desktop berjalan.

2. Install dependency:

```powershell
npm install
```

3. Copy env jika belum ada:

```powershell
Copy-Item .env.example .env
```

Isi minimal:

```env
DATABASE_URL="postgresql://riqo:riqo_dev_password@127.0.0.1:5432/riqo_ai_hub?schema=public"
MASTER_ENCRYPTION_KEY="replace-with-32-byte-base64-key"
SESSION_SECRET="replace-with-random-session-secret"
RIQO_INTERNAL_API_TOKEN="replace-with-local-token-for-v1-endpoints"
```

Catatan Windows: pakai `127.0.0.1`, bukan `localhost`, agar driver PostgreSQL Node tidak salah memilih jalur koneksi.

4. Start PostgreSQL:

```powershell
docker compose up -d postgres
```

5. Generate Prisma client dan migrate database:

```powershell
npm run db:generate
npm run db:migrate
```

6. Jalankan app:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

7. Buka [http://127.0.0.1:3000](http://127.0.0.1:3000), buat owner pertama, lalu masuk ke Chat.

## 9Router Gateway Setup

1. Jalankan 9Router lokal.
2. Pastikan endpoint 9Router aktif, default: `http://localhost:20128/v1`.
3. Di 9Router, kelola semua API key provider dan combo/model di sana.
4. Di Riqo, buka `9Router Gateway`.
5. Klik `Add gateway`, isi nama gateway dan endpoint.
6. Paste hanya API key gateway dari 9Router Endpoint > API Keys.
7. Isi combo awal untuk `General Main`, misalnya `everything` atau `cx/gpt-5.5`.
8. Klik `Save gateway`.
9. Klik `Sync` pada kartu gateway untuk membaca daftar combo/model dari 9Router.
10. Pilih combo dari dropdown, lalu klik `Use combo`.
11. Klik `Test` untuk memastikan gateway dan combo merespons.

Jika punya lebih dari satu install 9Router, tambahkan gateway kedua. Kartu `Active route` selalu menampilkan gateway, combo, endpoint, dan gateway key yang sedang dipakai chat.

Riqo tidak lagi dimaksudkan untuk menyimpan banyak API key provider. Riqo hanya memakai 9Router sebagai gateway OpenAI-compatible.

## Manual Web dan Handoff

Menu `Manual` menjelaskan cara pakai aplikasi untuk user non-teknis dan berisi development log yang harus ikut diperbarui setiap perubahan besar.

Untuk memindahkan progres ke IDE/AI agent lain:

1. Buka `Manual`.
2. Klik `Create handoff`.
3. Ambil folder export di `exports/riqo-handoff-...`.
4. Berikan folder itu ke agent lain.

Isi export:

- `project-files/`: source code aman tanpa `.env`, `.next`, `node_modules`, `storage`, atau secret.
- `handoff-data.json`: snapshot database aman, termasuk conversation history, messages, providers/gateways tanpa encrypted secret, memory, documents, usage log, dan audit log.
- `PROJECT_TREE.txt`: peta folder.
- `README-HANDOFF.md`: instruksi untuk agent penerima.

Secret asli tidak ikut diekspor. Gateway key 9Router dan `.env` harus dimasukkan ulang di environment tujuan.

## Chat Test

1. Pastikan 9Router berjalan dan gateway key aktif di Riqo.
2. Buka `Chat`.
3. Pilih route `General Main`.
4. Kirim pesan.
5. Response akan streaming, message disimpan, dan usage muncul di `Usage & Tokens`.

Jika gateway key salah atau 9Router mati, Chat akan memberi error gateway. Perbaiki di `9Router Gateway`.

## Memory

1. Buka `Memory`.
2. Tambahkan memory user/global, misalnya preferensi gaya jawaban.
3. Memory yang enabled akan otomatis di-embed lewat 9Router jika model embedding tersedia.
4. Search memory memakai semantic ranking, lalu fallback ke keyword jika embedding gagal.
5. Pilih conversation lalu klik `Suggest from chat` untuk membuat suggestion.
6. Tekan `Approve` agar suggestion menjadi memory aktif, atau `Reject` untuk membuangnya.

Auto memory tidak langsung aktif. Semua hasil ekstraksi tetap masuk approval queue dulu.

## Documents

1. Buka `Documents` atau klik tombol upload di Chat.
2. Upload file: PDF, DOCX, TXT, MD, CSV, XLSX.
3. App menyimpan file ke `storage/uploads`, mengekstrak text, memecah chunk, lalu mencoba membuat embedding.
4. Search document chunks memakai semantic ranking jika embedding tersedia.
5. Klik `Reindex` pada dokumen atau `Reindex all` setelah mengganti model embedding.
6. Dokumen yang diupload dari Chat melekat ke conversation dan otomatis ikut dipertimbangkan sebagai context saat pertanyaan berikutnya relevan.

Catatan: upload dibatasi 20MB per file pada mode lokal.

## 9Router Embeddings

1. Pastikan gateway 9Router aktif di menu `9Router Gateway`.
2. Buka `Settings`.
3. Isi model embedding, default `text-embedding-3-small`.
4. Klik `Test embedding`.
5. Jika 9Router belum menyediakan model embedding, Riqo tetap berjalan dengan fallback keyword. Setelah model siap, jalankan `Reindex all` di `Documents` dan edit/simpan ulang memory penting bila perlu.

## Internal OpenAI-Compatible Endpoint

Gunakan bearer token dari `RIQO_INTERNAL_API_TOKEN`:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:3000/v1/models `
  -Headers @{ Authorization = "Bearer $env:RIQO_INTERNAL_API_TOKEN" }
```

Streaming chat:

```powershell
Invoke-WebRequest `
  -Uri http://127.0.0.1:3000/v1/chat/completions `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $env:RIQO_INTERNAL_API_TOKEN" } `
  -Body '{"model":"general-main","stream":true,"messages":[{"role":"user","content":"Halo Riqo"}]}'
```

## Verification

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Current automated tests cover:

- AES-256-GCM encrypt/decrypt round trip.
- Secret masking.
- Round-robin key ordering.
- Document chunking and storage-name sanitizing.
- Embedding parser, vector parsing, cosine similarity, dan keyword fallback score.

Manual browser yang penting dicek:

- `9Router Gateway`: tambah gateway, sync combo, pilih combo, tambah key, aktifkan key, hapus combo/key/gateway.
- `Chat`: area input dan bubble assistant menampilkan gateway, combo, model aktual, dan gateway key.
- `Settings`: `Test embedding` berhasil atau menampilkan error aman tanpa secret.
- `Documents`: upload, reindex, semantic/keyword search menampilkan score dan match type.
- `Memory`: suggest from chat, approve/reject, dan memory aktif ikut semantic retrieval.
- `Manual`: tombol handoff membuat folder export.

## VPS Deployment Guide

Recommended baseline:

- Ubuntu LTS VPS.
- Node.js 24 LTS/current compatible runtime.
- PostgreSQL 16 managed locally or via managed DB.
- Reverse proxy: Caddy or Nginx.
- Process manager: systemd or PM2.

Production steps:

1. Set production `.env` with strong `MASTER_ENCRYPTION_KEY`, `SESSION_SECRET`, and production `DATABASE_URL`.
2. Run:

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm run start
```

3. Put the app behind HTTPS.
4. Restrict database access to the app host.
5. Keep `.env` out of git and backups unless encrypted.

## Future Integration Guides

Google OAuth:

- Create OAuth client in Google Cloud Console.
- Add redirect URI for your domain, later mapped to `/api/google/callback`.
- Use granular scopes for Gmail, Drive, Calendar, Docs, and Sheets.
- Store refresh/access tokens encrypted with the same secret storage layer.

Telegram:

- Create bot via BotFather.
- Store bot token encrypted.
- Restrict allowed chat IDs.
- Safe Mode remains default for outbound actions.

WhatsApp:

- Planned free mode uses WhatsApp Web session through Baileys or whatsapp-web.js.
- This is not the official Meta WhatsApp Business API.
- Session can disconnect, QR login may need renewal, and it must not be used for spam or mass broadcast.

## Security Notes

- Do not paste production secrets into chat messages.
- API keys and future OAuth/channel tokens are encrypted at rest.
- Raw API keys are never logged intentionally.
- Safe Mode is default ON.
- Risky actions in later phases must require confirmation.
- `.env` is ignored by git.

## Known Limitations

- Semantic retrieval masih app-level memakai JSON vector, belum pgvector.
- Embedding bergantung pada model `/v1/embeddings` yang tersedia di 9Router.
- No Google/Telegram/WhatsApp runtime integration yet.
- No coding/browser agent execution yet.
- Token counts depend on provider metadata when available; otherwise Phase 2 uses a rough local estimate.
- `npm audit` reports dependency warnings from the document parsing ecosystem; review or replace those packages before hardening for production.
