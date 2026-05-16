# Setup Checklist untuk Auto GitHub Sync

## Status Saat Ini

✅ **Sudah Selesai:**
1. Clone repo AGENT-MANAGEMENT ke `temp_agent_mgmt/`
2. `.gitignore` sudah aman (`.env*`, `storage`, `exports`, `node_modules`, `.next` ignored)
3. `.env` dibuat dari `.env.example` (EDIT SECRETS MANUALLY!)
4. `npm install` selesai (702 packages installed)
5. Docker Desktop diminta start (sedang booting)

⏳ **Perlu Dilakukan Manual:**

### 1. Edit `.env` dengan secret yang aman
```bash
cd temp_agent_mgmt
code .env
```

Edit nilai berikut:
- `MASTER_ENCRYPTION_KEY` → generate random 32-byte base64
- `SESSION_SECRET` → generate random string
- `RIQO_INTERNAL_API_TOKEN` → generate random token
- `GOOGLE_OAUTH_CLIENT_ID` → (opsional, untuk Phase 4)
- `GOOGLE_OAUTH_CLIENT_SECRET` → (opsional, untuk Phase 4)

### 2. Tunggu Docker Desktop selesai start
Cek dengan:
```powershell
docker ps
```

Jika sudah ready, jalankan PostgreSQL:
```powershell
cd temp_agent_mgmt
docker compose up -d postgres
```

### 3. Setup Prisma
```powershell
cd temp_agent_mgmt
npm run db:generate
npm run db:migrate
```

### 4. Verifikasi build
```powershell
cd temp_agent_mgmt
npm run typecheck
npm run lint
npm run test
npm run build
```

### 5. Test dev server
```powershell
cd temp_agent_mgmt
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Buka http://127.0.0.1:3000 dan buat owner pertama.

### 6. Setup Git Remote (jika belum)
```powershell
cd temp_agent_mgmt
git remote -v
```

Jika belum ada remote `origin`, tambahkan:
```powershell
git remote add origin https://github.com/thoriqo-bowzbow/AGENT-MANAGEMENT.git
```

### 7. Aktifkan Auto GitHub Sync
Buka terminal khusus dan jalankan:
```powershell
cd temp_agent_mgmt
npm run git:auto-sync
```

**Biarkan terminal ini tetap hidup.**

Setiap perubahan file akan:
- Auto `git add .`
- Auto commit dengan message `Auto sync: timestamp`
- Auto push ke `origin/main`

## Catatan Penting

- **Terminal watcher harus tetap jalan** untuk auto-sync aktif
- File sensitif sudah di-ignore: `.env*`, `storage/`, `exports/`
- Vulnerability warnings dari `npm audit` normal untuk dependency parsing dokumen
- Auto-sync cocok untuk kerja solo, bisa berisik untuk tim
- Jika `git push` butuh auth, Git Credential Manager akan pakai login GitHub yang sudah ditautkan

## Troubleshooting

### Docker tidak start
```powershell
# Manual start Docker Desktop dari Start Menu
# Atau:
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### Git push gagal (conflict)
```powershell
cd temp_agent_mgmt
git pull --rebase origin main
git push origin main
```

### Prisma migrate gagal
```powershell
cd temp_agent_mgmt
docker compose down
docker compose up -d postgres
Start-Sleep -Seconds 5
npm run db:migrate
```
