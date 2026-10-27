# ADR-011: Routing Reuni — /reuni vs /dashboard/reuni

**Tanggal:** 28 Oktober 2026
**Status:** Diterima (dokumentasi, tanpa perubahan kode)
**Pembuat:** Beta (audit O4)
**Branch:** fix/opsional-o1-o8-s11

## Konteks

Audit menandai `/dashboard/reuni` sebagai duplikat `/reuni`. Setelah ditelusuri,
keduanya BUKAN duplikat fungsional:

| Rute | Audiens | Isi data |
|------|---------|----------|
| `/reuni` | Publik (tamupun belum punya akun) | Semua reuni berstatus PUBLISHED, jadwal mendatang + arsip, CTA registrasi & buku tamu |
| `/dashboard/reuni` | Anggota yang sudah masuk | Hanya pendaftaran milik user itu (`reunionRegistration.userId = session.user.id`) dengan status pendaftarannya (Terdaftar/Daftar tunggu/Dibatalkan) |

Keduanya memakai sumber data berbeda (`reunion` vs `reunionRegistration`) dan
saling terhubung: `/dashboard/reuni` mengarahkan "Lihat Jadwal Reuni" ke
`/reuni`, dan halaman detail `/reuni/[slug]` melayani keduanya.

## Keputusan

Pertahankan kedua rute. Tidak ada konsolidasi atau redirect:

1. Menggabungkan keduanya memaksa halaman publik `/reuni` membaca sesi login,
   padahal halaman itu sengaja tanpa sesi (dibagikan lewat QR dan grup keluarga).
2. Memisahkan "jadwal untuk umum" dan "pendaftaran saya" adalah pola yang sudah
   dipakai modul lain (artikel, galeri), bukan anomali routing.
3. Nama `/dashboard/reuni` selaras dengan section dashboard anggota lain
   (`/dashboard/notifikasi`, `/dashboard/profil`, `/dashboard/pengajuan`).

## Tindakan lanjutan yang diambil

- Link silang sudah ada: halaman `/dashboard/reuni` menautkan `/reuni`
  (empty state "Lihat Jadwal Reuni") dan tiap item menuju `/reuni/[slug]`.
- Dokumen ini menjadi rujukan kalau nanti muncul pertanyaan serupa.

## Kapan perlu ditinjau ulang

- Jika fitur reuni berkembang (mis. tiket, pembayaran, absensi per anggota),
  pertimbangkan memecah `/dashboard/reuni` menjadi sub-rute sendiri, bukan
  menggabungkannya ke `/reuni`.
