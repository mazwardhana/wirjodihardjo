# backups

Cadangan database untuk aplikasi keluarga Wirjodihardjo.

## Isi

- `skema-wirjodihardjo.sql` - skema saja (tabel, enum, indeks, constraint),
  tanpa data pribadi. Aman untuk repo publik.
- `CARA-IMPOR.md` - panduan lengkap impor dan pemulihan, termasuk catatan untuk
  agen AI.

## Dump penuh

Dump penuh yang berisi data keluarga asli **tidak disimpan di repo ini**.
Alasannya ada di `CARA-IMPOR.md`. File dengan pola `*.dump` dan `*.dump.sql`
diblokir oleh `.gitignore` di folder ini supaya tidak pernah ikut ter-commit.

Simpan dump penuh di luar repo, misalnya di
`/opt/projects/backups/wirjodihardjo/`.
