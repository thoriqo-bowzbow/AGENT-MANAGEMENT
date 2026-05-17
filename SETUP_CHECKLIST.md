# Setup Checklist

## Status

✅ Project sudah dirapihkan ke root folder `proyek-21/`.

## 1. Environment

Edit `.env`:

```powershell
code .env
```

Pastikan nilai berikut aman:
- `MASTER_ENCRYPTION_KEY`
- `SESSION_SECRET`
- `RIQO_INTERNAL_API_TOKEN`
- `GOOGLE_OAUTH_CLIENT_ID` (opsional)
- `GOOGLE_OAUTH_CLIENT_SECRET` (opsional)

## 2. Database

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
```

## 3. Verifikasi

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

## 4. Dev Server

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Buka:

```text
http://127.0.0.1:3000
```

## Catatan Keamanan

- `.env*` tidak boleh masuk Git.
- Jangan simpan secret/token asli di dokumentasi.
- Auto GitHub sync / watcher lama sudah dihapus.
- Rate-limit helper lama yang tidak terpakai sudah dihapus.