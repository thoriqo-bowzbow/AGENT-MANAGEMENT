# 🚀 Panduan Menyalakan & Mengelola 9Router

Dokumentasi singkat ini dibuat agar Anda tidak lupa cara menjalankan, memperbarui, atau mengelola **9Router Gateway** di komputer Windows Anda.

---

## 1. Cara Menyalakan (Paling Sering Digunakan)

Jika layanan 9Router mati atau komputer habis di-restart, ikuti langkah ini:

1. Buka **PowerShell** atau **Terminal** (bisa dari VS Code atau Windows Terminal).
2. Jalankan perintah berikut:
   ```powershell
   9router
   ```
3. **Selesai!** Layanan otomatis berjalan di latar belakang pada alamat:
   * **Endpoint:** `http://localhost:20128/v1`
   * **Web UI Dashboard:** `http://localhost:20128/dashboard`

*(Anda bisa langsung menutup terminal jika memilih opsi "Hide to Tray" di terminal, atau biarkan terminal tetap terbuka).*

---

## 2. Cara Memperbarui ke Versi Terbaru (Upgrade)

Jika muncul notifikasi update atau Anda ingin memastikan menggunakan versi paling stabil:

1. Buka **PowerShell** atau **Terminal**.
2. Jalankan perintah upgrade berikut:
   ```powershell
   npm i -g 9router@latest --prefer-online
   ```
3. Jalankan kembali dengan mengetik `9router`.

---

## 3. Cara Memeriksa Apakah 9Router Sudah Jalan

Untuk memastikan apakah port 9Router (`20128`) sudah aktif mendengarkan koneksi:

* **Cara Cepat (PowerShell):**
  ```powershell
  Test-NetConnection -ComputerName 127.0.0.1 -Port 20128
  ```
  Jika hasilnya menampilkan `TcpTestSucceeded : True`, berarti 9Router sudah menyala dengan aman!

---

## 4. Cara Mematikan 9Router (Stop)

Jika Anda perlu menghentikan layanan:
* Tekan tombol `Ctrl + C` pada jendela terminal tempat `9router` sedang berjalan.
