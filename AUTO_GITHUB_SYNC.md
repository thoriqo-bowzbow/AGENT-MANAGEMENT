# Auto GitHub Sync

Tool ini akan:

- watch perubahan file
- auto `git add .`
- auto `git commit`
- auto `git push origin main`

## File terkait

- Script: `scripts/auto-git-sync.mjs`
- NPM script: `git:auto-sync`

## Cara jalanin

```bash
npm run git:auto-sync
```

Lalu biarkan terminal tetap hidup.

## Cara kerja

- setiap ada perubahan file
- tunggu debounce `10 detik`
- commit message otomatis:
  - `Auto sync: 2026-05-13T06:00:00Z`
- lalu push ke `origin/main`

## Folder/file yg diabaikan

- `.git`
- `node_modules`
- `.next`
- `dist`
- `build`
- `coverage`
- `.turbo`
- file log `.codex-dev*`

## Env opsional

```bash
AUTO_GIT_SYNC_DEBOUNCE_MS=10000
AUTO_GIT_SYNC_REMOTE=origin
AUTO_GIT_SYNC_BRANCH=main
```

## Contoh custom

```bash
set AUTO_GIT_SYNC_DEBOUNCE_MS=3000
npm run git:auto-sync
```

## Catatan penting

- terminal watcher **harus tetap jalan**
- kalau `git push` butuh auth, Git Credential Manager akan pakai login GitHub yg sudah kamu tautkan
- script ini cocok untuk kerja solo
- untuk kerja tim, full auto-commit bisa bikin history commit berisik

## Rekomendasi pakai

1. buka terminal khusus
2. jalankan:
   ```bash
   npm run git:auto-sync
   ```
3. biarkan aktif selama ngoding

## Batasan

- script ini push **semua perubahan**
- kalau ada file sensitif belum masuk `.gitignore`, file itu bisa ikut ter-push
- kalau konflik remote terjadi, push bisa gagal sampai conflict diselesaikan manual