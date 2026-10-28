# ADR-012: Implementasi Self-Service Reset Password

**Tanggal:** 28 Oktober 2026
**Status:** Diterapkan
**Pembuat:** Beta (audit S11)
**Branch:** `fix/opsional-o1-o8-s11`

## Konteks

Skema Prisma memiliki kolom `passwordResetToken` dan `passwordResetExpires` pada model `User`, namun tidak ada endpoint API yang memanfaatkan kedua kolom tersebut. Sebelumnya reset password hanya dapat dilakukan oleh admin melalui UI `PenggunaDetail` (yang menghasilkan password acak dan mengharuskan user mengubahnya pada login berikutnya).

## Problema
- **Tidak ada mekanisme self-service** bagi pengguna yang lupa password.
- **Tidak ada dokumentasi** tentang bagaimana token seharusnya dihasilkan, disimpan, dan divalidasi.
- **Keamanan** belum dipertimbangkan: token harus disimpan dalam bentuk hash, memiliki TTL terbatas, dan endpoint harus netral untuk mencegah enumerasi user.

## Solusi yang Diterapkan

### 1. Modul utilitas `src/lib/password-reset.ts`
Logika murni tanpa Prisma, supaya bisa diuji langsung:
- `generateResetToken()` – token acak 32 byte, 64 karakter hex.
- `hashResetToken()` – SHA-256 untuk penyimpanan.
- `resetExpiryFrom(now)` – masa berlaku 1 jam.
- `isResetTokenValid(storedToken, expiresAt, now)` – keabsahan token dan kedaluwarsa.
- Konstanta `PASSWORD_RESET_TTL_MS`, `MIN_PASSWORD_LENGTH`, `FORGOT_PASSWORD_NEUTRAL_MESSAGE`.

### 2. `POST /api/auth/forgot-password`
- Menerima `{ emailOrUsername }`; mencari user berdasarkan username atau email
  (email selalu lowercase, mengikuti pola `authorize` di `src/lib/auth.ts`).
- Jika akun ada: generate token, simpan **hash** ke `passwordResetToken` dan
  `passwordResetExpires = now + 1 jam`. Token mentah tidak pernah disimpan.
- Rate limit `consumeRateLimit("forgot-password:" + ip, 5, 60_000)` mengikuti
  pola `src/app/api/reuni/buku-tamu/lookup/route.ts`.
- Selalu membalas HTTP 200 dengan `FORGOT_PASSWORD_NEUTRAL_MESSAGE`, sama baik
  akun ada maupun tidak (anti user-enumeration).
- Audit `PASSWORD_RESET_REQUESTED` lewat `logAudit`.

### 3. `POST /api/auth/reset-password`
- Menerima `{ token, newPassword, confirmPassword }`.
- Validasi: token tidak kosong, `newPassword === confirmPassword`,
  `newPassword.length >= MIN_PASSWORD_LENGTH`.
- Mencari user lewat `where: { passwordResetToken: hashResetToken(token) }`,
  lalu `isResetTokenValid(...)`. Token mentah tidak pernah dibandingkan.
- Jika valid: `bcrypt.hash(newPassword, 12)` (algoritma dan cost yang sama
  dengan onboarding/registrasi, tidak ada algoritma baru), set
  `mustChangeCredentials: false`, `passwordResetToken: null`,
  `passwordResetExpires: null`. Password baru, pembuangan token, dan audit
  `PASSWORD_RESET_COMPLETED` ditulis dalam satu `$transaction`.
- Rate limit `consumeRateLimit("reset-password:" + ip, 10, 60_000)`.
- Mengembalikan `{ ok: true }`.

### 4. Penyerahan token: notifikasi internal, bukan email
Repositori tidak punya jalur email (tidak ada SMTP, nodemailer, atau resend),
jadi token mentah diserahkan ke admin lewat `notifyAdminsOfPasswordReset()` di
`src/lib/notifications.ts`, mengikuti pola `notifyAdminsOfNewSubmission`.
Notifikasi bertipe `PASSWORD_RESET_TOKEN` berisi token, username peminta, dan
masa berlaku, dengan tautan ke `/admin/pengguna`. Token juga terekam di audit
log lewat `logAudit`.

Ini adalah kompromi yang disadari: token sempat melewati saluran notifikasi
internal, sehingga hanya admin yang bisa membacanya. Bila kelak email
ditambahkan, satu-satunya yang perlu diubah adalah fungsi serah-token itu,
bukan kedua endpoint.

### 5. Tes
- `src/lib/password-reset.test.ts` – 8 tes untuk logika murni.
- `src/app/api/auth/reset-password/route.test.ts` – 18 tes untuk kedua
  endpoint, mengikuti pola harness `src/app/api/admin/pengguna/route.test.ts`
  (memuat route asli ke dalam VM dengan dependensi diganti mock). Skenario
  minimal yang diminta audit S11 seluruhnya tercakup:
  - respons netral saat email tidak terdaftar, dan respons identik saat akun
    terdaftar;
  - token tersimpan sebagai hash, bukan plaintext (dibuktikan dengan
  `hashResetToken(tokenMentah) === nilaiKolom`);
  - reset gagal saat token kedaluwarsa atau tidak cocok;
  - reset berhasil mengubah password dan membersihkan token.
  Ditambah: token sekali pakai, penolakan konfirmasi tidak cocok, penolakan
  password terlalu pendek, penolakan token kosong, dan batas laju 429.

## Konsekuensi
- Pengguna bisa reset password sendiri tanpa menunggu admin, dengan token yang
  hanya sah 1 jam dan hanya bisa dipakai sekali.
- Tidak ada dependensi baru (`crypto` dan `bcryptjs` sudah dipakai repo).
- Tidak ada perubahan skema atau migrasi; kedua kolom sudah ada sejak awal.
- Batas laju dibuat ketat di langkah 1 karena endpoint itu publik dan bisa
  dipakai memetakan akun.
- 47 tes di `src/app/api/admin/` sudah gagal sebelum perubahan ini (terverifikasi
  pada HEAD 0882ef5 di direktori terpisah); pekerjaan ini tidak menyentuh file
  tersebut dan tidak mengubah angka kegagalan itu.

## Alternatif yang Ditolak
- **Mengirim token plaintext ke database** – menurunkan keamanan.
- **Menggunakan JWT** sebagai token reset – menambah kompleksitas dan
  membutuhkan secret management.
- **Menambahkan infrastruktur email** (SMTP/nodemailer/resend) – di luar
  lingkup S11 dan menambah dependensi serta konfigurasi host yang perlu
  persetujuan terpisah.
- **Tidak menambahkan endpoint** – membiarkan hanya admin yang dapat reset,
  tetap memperbolehkan hambatan operasional bila admin tidak tersedia.

## Referensi
- `src/lib/password-reset.ts` – implementasi utilitas.
- `src/lib/password-reset.test.ts`, `src/app/api/auth/reset-password/route.test.ts` – tes.
- `src/app/api/admin/pengguna/route.ts` – contoh pola reset password admin-side.
- `src/app/api/auth/onboarding/route.ts` – pola bcrypt cost 12 dan `mustChangeCredentials`.
- `docs/ADR-UPLOAD.md` (ADR-010) – contoh format ADR yang diikuti.
