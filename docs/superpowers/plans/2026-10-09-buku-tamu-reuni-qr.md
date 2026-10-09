# Buku Tamu Reuni via QR Code (Registrasi Kehadiran Hari-H)

**Goal:** Tambah fitur buku tamu reuni: satu QR code di lokasi, tamu scan, pilih keluarga cabang, cari namanya di basis data, tandai hadir, dan tambah anggota rombongannya. Tamu yang namanya belum ada di basis data dapat ditambahkan manual sebagai usulan; akun untuk mereka baru dibuat setelah admin menyetujui.

**Architecture:** Lima lapis: (1) tambah kolom jejak kehadiran pada `ReunionRegistration` (`checkedInAt`, `checkInSource`, `checkInGroupId`) lewat migrasi aditif; (2) modul server `src/lib/buku-tamu.ts` berisi seluruh logika (pencarian nama, absen anggota lama, buat orang baru, rombongan) yang dapat diuji dengan DB palsu seperti `registrasi.ts`; (3) dua route publik tanpa login (`/api/reuni/buku-tamu/lookup`, `/api/reuni/buku-tamu`) dengan pembatas laju; (4) halaman publik `/reuni/buku-tamu` berupa wizard mobile-first; (5) panel admin di `/admin/reuni/[id]` untuk QR, daftar rombongan, persetujuan akun, dan pembatalan absen.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, TypeScript 5, Tailwind 4. Tes dijalankan dengan `npx tsx --test <file>` (tanpa agregator). Satu dependensi baru: `qrcode` (pembuat QR server-side, tanpa dependensi native).

**Spec:** permintaan produk dalam sesi 2026-10-09.

## Global Constraints

- Jalankan tes per file: `npx tsx --test <path>`; tidak ada `npm test`.
- `npx tsc --noEmit` harus 0 error; `npx eslint <file>` bersih; `npm run build` sukses.
- Cabang kerja: `main` (alur repo ini adalah commit langsung ke `main` lalu deploy; disetujui pengguna).
- Migrasi aditif saja. Jangan pernah `prisma migrate reset` (DB ini dipakai produksi). Alur: `prisma migrate diff --from-config-datasource --to-schema-datamodel` lalu `prisma migrate resolve --applied <nama>`.
- Endpoint buku tamu **publik tanpa login**. Karena itu: pencarian minimal 2 huruf, `take` maksimal 10, tanpa field sensitif (tanpa alamat, telepon, email, tanggal lahir).
- RBAC fail-closed pada endpoint admin: hanya `SUPER_ADMIN` atau `BRANCH_ADMIN` aktif.
- Setiap perubahan data lewat admin (persetujuan akun, pembatalan absen) menulis `logAudit`.
- Copy UI berbahasa Indonesia, tanpa em dash.
- Kehadiran (`checkedInAt`) adalah sumber kebenaran buku tamu. Semua peserta, termasuk yang sudah mendaftar reuni sebelumnya, harus melewati buku tamu agar dihitung hadir.
- Nomor telepon, alamat, dan email tamu tidak pernah diminta di buku tamu.

## Review Focus

1. **Absen ganda**: satu orang menekan tombol dua kali, atau dua perangkat mengirim bersamaan. Uji: dua `POST` untuk `personId` yang sama pada reuni yang sama menghasilkan satu baris `ReunionRegistration` (yang kedua mengembalikan status `ALREADY_CHECKED_IN`, bukan error 500). `@@unique([reunionId, personId])` di DB adalah jaring terakhir; `P2002` harus ditangkap, bukan dibiarkan naik.
2. **Orang lama yang belum absen**: anggota yang sudah punya baris pendaftaran reuni (dari form `/registrasi` atau impor) tetap harus lewat buku tamu. Uji: `lookup` mengembalikan `alreadyRegistered: true, checkedIn: false`, dan `POST` mengisi `checkedInAt` pada baris yang sudah ada, bukan membuat baris baru.
3. **Walk-in ganda**: tamu mengetik nama yang sama dua kali dalam satu kiriman, atau dua tamu berbeda mengetik nama yang identik di cabang yang sama. Uji: dalam satu transaksi, nama identik dipakai ulang (satu `Person`, bukan dua); antar transaksi, `Person` kedua tetap dibuat tetapi ditandai agar admin dapat menggabungkannya.
4. **Akun dibuat sebelum disetujui**: usulan walk-in tidak boleh menghasilkan `User`. Uji: setelah `POST` buku tamu dengan baris walk-in, jumlah `User` tidak bertambah dan baris itu muncul di daftar "perlu persetujuan".
5. **Persetujuan akun ganda**: admin menyetujui dua kali. Uji: panggilan kedua mengembalikan `ALREADY_HAS_ACCOUNT` dan tidak membuat `User` kedua (satu `Person` hanya boleh punya satu `User`, `User.personId` unik).
6. **Pembatalan absen menghapus riwayat pendaftaran**: membatalkan absen hanya mengosongkan `checkedInAt`, tidak menghapus baris pendaftaran, tidak menghapus `Person`, tidak menghapus `User`.
7. **Pembatas laju bocor**: endpoint publik dipanggil berulang dari satu IP. Uji: panggilan ke-31 dalam satu menit mengembalikan 429, dan panggilan dari IP lain tetap 200.
8. **Enumerasi nama**: `lookup` dipanggil dengan kata kunci satu huruf atau kosong. Uji: ditolak 400 tanpa menyentuh DB.

---

### Task 1: Migrasi jejak kehadiran

**Files:**
- Modify: `prisma/schema.prisma` (model `ReunionRegistration`, tambah `enum CheckInSource`)
- Create: `prisma/migrations/20261009000000_add_reunion_checkin/migration.sql`

**Interfaces:**
- Consumes: tidak ada dari task lain.
- Produces: `ReunionRegistration.checkedInAt: DateTime | null`, `ReunionRegistration.checkInSource: CheckInSource | null`, `ReunionRegistration.checkInGroupId: String | null`; `enum CheckInSource { QR_SELF, ADMIN }`. Semua task lain membaca tiga kolom ini.

**Konteks:** `ReunionRegistration.attendance` (`ATTENDING`/`NOT_ATTENDING`) sudah ada dan berarti "rencananya hadir", diisi panitia menjelang hari-H. Itu tidak boleh dipakai ulang untuk kehadiran hari-H: hampir semua pendaftar lama bernilai `ATTENDING` sehingga tidak akan pernah lewat buku tamu. Kolom baru `checkedInAt` memisahkan "terdaftar" dari "sudah absen".

- [ ] **Step 1: Ubah skema**

Tambahkan enum setelah `AttendanceStatus`:

```prisma
// Cara baris kehadiran ini terisi: tamu memindai QR sendiri di lokasi, atau
// dicatat panitia dari panel admin. Kosong berarti baris lama dari pendaftaran
// reuni biasa (form /registrasi atau impor), yang belum melewati buku tamu.
enum CheckInSource {
  QR_SELF
  ADMIN
}
```

Tambahkan ke `model ReunionRegistration` setelah `attendance`:

```prisma
  // Buku tamu hari-H. `attendance` di atas tetap berarti rencana hadir; kolom
  // ini yang membuktikan orang benar-benar datang dan kapan.
  checkedInAt    DateTime?
  checkInSource  CheckInSource?
  // Satu kiriman buku tamu menghasilkan satu grup. Dipakai admin untuk melihat
  // "rombongan ini datang bersama" dan membatalkan satu kiriman sekaligus.
  checkInGroupId String?

  @@index([reunionId, checkedInAt])
  @@index([checkInGroupId])
```

- [ ] **Step 2: Hasilkan SQL migrasi**

```bash
npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20261009000000_add_reunion_checkin/migration.sql
```

Periksa isinya: hanya `CREATE TYPE` dan `ALTER TABLE ... ADD COLUMN` serta `CREATE INDEX`. Tidak boleh ada `DROP`.

- [ ] **Step 3: Daftarkan migrasi tanpa reset**

```bash
npx prisma migrate resolve --applied 20261009000000_add_reunion_checkin
npx prisma generate
```

Expected: `prisma migrate status` melaporkan skema terkini, tidak ada migrasi tertunda.

- [ ] **Step 4: Verifikasi kolom benar-benar ada di DB**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ReunionRegistration'
  AND column_name IN ('checkedInAt', 'checkInSource', 'checkInGroupId');
SQL
```

Expected: tiga baris, semuanya `is_nullable = YES`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261009000000_add_reunion_checkin
git commit -m "feat(buku-tamu): migrasi jejak kehadiran pada pendaftaran reuni"
```

---

### Task 2: Modul `src/lib/buku-tamu.ts`

**Files:**
- Create: `src/lib/buku-tamu.ts`
- Test: `src/lib/buku-tamu.test.ts`

**Interfaces:**
- Consumes: kolom dari Task 1.
- Produces:
  - `type CheckInDb`, `type CheckInTx` (batas minimal untuk Prisma palsu, pola sama seperti `RegistrationDb` di `registrasi.ts`)
  - `type LookupCandidate = { personId: string; fullName: string; namaPanggilan: string | null; gender: Gender; branchName: string | null; branchNumber: number | null; alreadyRegistered: boolean; checkedIn: boolean }`
  - `lookupCandidates(db, { reunionId, branchId, q }): Promise<LookupCandidate[]>`
  - `type CheckInRowInput = { personId: string } | { fullName: string; namaPanggilan: string; gender: Gender }`
  - `type CheckInResult = { groupId: string; checkedIn: string[]; alreadyCheckedIn: string[]; created: string[] }`
  - `checkIn(db, { reunionId, branchId, rows, source, actorUserId }): Promise<CheckInResult>`
  - `approveWalkInAccount(db, { personId, actorUserId }): Promise<{ username: string } | "ALREADY_HAS_ACCOUNT">`
  - `cancelCheckIn(db, { registrationId, actorUserId }): Promise<boolean>`
  - `MIN_QUERY_LENGTH = 2`, `MAX_LOOKUP_RESULTS = 10`, `MAX_ROWS_PER_GROUP = 20`

**Konteks:** Modul ini meniru `registrasi.ts`: seluruh logika di satu tempat, batas DB berupa tipe kecil agar dapat diuji tanpa Postgres. Kata sandi akun walk-in memakai `DEFAULT_REGISTRATION_PASSWORD` dan `REGISTRATION_BCRYPT_ROUNDS` dari `@/lib/registrasi` supaya kebijakan sandi hanya ada di satu tempat. Username memakai `deriveUniqueUsername` dari `@/lib/import/username`.

- [ ] **Step 1: Tulis tes pencarian (RED)**

```ts
test("lookupCandidates menolak kata kunci kurang dari dua huruf tanpa menyentuh DB", async () => {
  const db = fakeDb({ persons: [] });
  await assert.rejects(() => lookupCandidates(db, { reunionId: "r1", branchId: "b1", q: "a" }), /QUERY_TOO_SHORT/);
  assert.equal(db.calls.personFindMany, 0);
});

test("lookupCandidates menandai anggota yang sudah terdaftar tetapi belum lewat buku tamu", async () => {
  const db = fakeDb({
    persons: [{ id: "p1", fullName: "Sri Wahyuni", namaPanggilan: "Yuni", gender: "FEMALE", branch: { name: "Keluarga A", branchNumber: 1 } }],
    registrations: [{ personId: "p1", checkedInAt: null }],
  });
  const rows = await lookupCandidates(db, { reunionId: "r1", branchId: "b1", q: "yuni" });
  assert.equal(rows[0].alreadyRegistered, true);
  assert.equal(rows[0].checkedIn, false);
});

test("lookupCandidates menandai anggota yang sudah absen", async () => {
  const db = fakeDb({
    persons: [{ id: "p1", fullName: "Sri Wahyuni", namaPanggilan: "Yuni", gender: "FEMALE", branch: { name: "Keluarga A", branchNumber: 1 } }],
    registrations: [{ personId: "p1", checkedInAt: new Date("2027-03-13T02:00:00Z") }],
  });
  const rows = await lookupCandidates(db, { reunionId: "r1", branchId: "b1", q: "yuni" });
  assert.equal(rows[0].checkedIn, true);
});

test("lookupCandidates tidak mengembalikan lebih dari sepuluh baris dan tanpa field sensitif", async () => {
  const db = fakeDb({ persons: Array.from({ length: 30 }, (_, i) => person(`p${i}`)) });
  const rows = await lookupCandidates(db, { reunionId: "r1", branchId: "b1", q: "wi" });
  assert.ok(rows.length <= MAX_LOOKUP_RESULTS);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["alreadyRegistered", "branchName", "branchNumber", "checkedIn", "fullName", "gender", "namaPanggilan", "personId"]);
  }
});
```

Run: `npx tsx --test src/lib/buku-tamu.test.ts`
Expected: FAIL, `lookupCandidates` belum ada.

- [ ] **Step 2: Implementasi `lookupCandidates` (GREEN)**

Query: `person.findMany({ where: { deletedAt: null, branchId, OR: [{ fullName: { contains: q, mode: "insensitive" } }, { namaPanggilan: { contains: q, mode: "insensitive" } }] }, select: {...}, take: MAX_LOOKUP_RESULTS, orderBy: { fullName: "asc" } })` lalu satu `reunionRegistration.findMany({ where: { reunionId, personId: { in: ids } }, select: { personId: true, checkedInAt: true } })`. `select` hanya field yang ada di `LookupCandidate`.

Run ulang: PASS.

- [ ] **Step 3: Tulis tes absen anggota lama (RED)**

```ts
test("checkIn mengisi checkedInAt pada baris pendaftaran yang sudah ada", async () => {
  const db = fakeDb({ registrations: [{ id: "reg1", personId: "p1", checkedInAt: null }] });
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ personId: "p1" }], source: "QR_SELF" });
  assert.deepEqual(result.checkedIn, ["p1"]);
  assert.deepEqual(result.created, []);
  assert.equal(db.state.registrations[0].checkedInAt instanceof Date, true);
  assert.equal(db.state.registrations[0].checkInGroupId, result.groupId);
});

test("checkIn tidak membuat baris kedua untuk orang yang sama", async () => {
  const db = fakeDb({ registrations: [{ id: "reg1", personId: "p1", checkedInAt: new Date() }] });
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ personId: "p1" }], source: "QR_SELF" });
  assert.deepEqual(result.alreadyCheckedIn, ["p1"]);
  assert.equal(db.state.registrations.length, 1);
});

test("checkIn membuat baris pendaftaran baru untuk anggota yang belum pernah mendaftar", async () => {
  const db = fakeDb({ persons: [{ id: "p2" }], registrations: [] });
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ personId: "p2" }], source: "QR_SELF" });
  assert.deepEqual(result.checkedIn, ["p2"]);
  assert.equal(db.state.registrations.length, 1);
  assert.equal(db.state.registrations[0].status, "CONFIRMED");
});

test("checkIn tidak membuat akun untuk baris walk-in", async () => {
  const db = fakeDb({ persons: [], registrations: [] });
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE" }], source: "QR_SELF" });
  assert.equal(result.created.length, 1);
  assert.equal(db.state.users.length, 0);
  assert.equal(db.state.persons[0].branchId, "b1");
});

test("checkIn memakai ulang orang yang sama bila nama identik dikirim dua kali dalam satu kiriman", async () => {
  const db = fakeDb({ persons: [], registrations: [] });
  const row = { fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE" as const };
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [row, { ...row }], source: "QR_SELF" });
  assert.equal(result.created.length, 1);
  assert.equal(result.alreadyCheckedIn.length, 1);
  assert.equal(db.state.persons.length, 1);
});

test("checkIn memisahkan dua baris walk-in yang berbeda menjadi dua orang", async () => {
  const db = fakeDb({ persons: [], registrations: [] });
  await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE" }, { fullName: "Sri Santoso", namaPanggilan: "Sri", gender: "FEMALE" }], source: "QR_SELF" });
  assert.equal(db.state.persons.length, 2);
});

test("checkIn menolak lebih dari dua puluh baris dalam satu kiriman", async () => {
  const db = fakeDb({ persons: [], registrations: [] });
  await assert.rejects(
    () => checkIn(db, { reunionId: "r1", branchId: "b1", rows: Array.from({ length: 21 }, (_, i) => ({ fullName: `Orang ${i}`, namaPanggilan: `O${i}`, gender: "MALE" as const })), source: "QR_SELF" }),
    /TOO_MANY_ROWS/,
  );
});

test("checkIn menerjemahkan pelanggaran unique menjadi alreadyCheckedIn, bukan error", async () => {
  const db = fakeDb({ persons: [{ id: "p1" }], registrations: [], raceOnCreate: "p1" });
  const result = await checkIn(db, { reunionId: "r1", branchId: "b1", rows: [{ personId: "p1" }], source: "QR_SELF" });
  assert.deepEqual(result.alreadyCheckedIn, ["p1"]);
});
```

Run: FAIL.

- [ ] **Step 4: Implementasi `checkIn` (GREEN)**

Satu `db.$transaction`. Urutan: buat `groupId` (uuid) di awal; untuk tiap baris tentukan `personId` (baris lama: pakai `personId`; baris walk-in: `person.findFirst({ fullName, branchId, deletedAt: null })`, bila ketemu pakai ulang, bila tidak `person.create`). Lalu `reunionRegistration.findFirst({ reunionId, personId })`: ada dan `checkedInAt` terisi -> `alreadyCheckedIn`; ada dan belum -> `update` (`checkedInAt: now`, `checkInSource`, `checkInGroupId: groupId`); tidak ada -> `create` (`status: "CONFIRMED"`, `attendance: "ATTENDING"`, `guestCount: 1`). Bungkus `create`/`update` dengan penangkap `P2002` yang memindahkan baris ke `alreadyCheckedIn`. Nomor urut deterministik: proses baris sesuai urutan masukan.

Run ulang: PASS.

- [ ] **Step 5: Tulis tes persetujuan akun dan pembatalan (RED)**

```ts
test("approveWalkInAccount membuat satu akun dengan sandi bawaan dan wajib ganti", async () => {
  const db = fakeDb({ persons: [{ id: "p1", namaPanggilan: "Budi", fullName: "Budi Santoso" }] });
  const result = await approveWalkInAccount(db, { personId: "p1", actorUserId: "admin1" });
  assert.equal(typeof result.username, "string");
  assert.equal(db.state.users.length, 1);
  assert.equal(db.state.users[0].mustChangeCredentials, true);
  assert.equal(db.state.users[0].role, "MEMBER");
});

test("approveWalkInAccount menolak bila orang sudah punya akun", async () => {
  const db = fakeDb({ persons: [{ id: "p1" }], users: [{ personId: "p1" }] });
  assert.equal(await approveWalkInAccount(db, { personId: "p1", actorUserId: "admin1" }), "ALREADY_HAS_ACCOUNT");
  assert.equal(db.state.users.length, 1);
});

test("cancelCheckIn hanya mengosongkan jejak kehadiran", async () => {
  const db = fakeDb({ registrations: [{ id: "reg1", personId: "p1", checkedInAt: new Date(), checkInSource: "QR_SELF", checkInGroupId: "g1" }] });
  assert.equal(await cancelCheckIn(db, { registrationId: "reg1", actorUserId: "admin1" }), true);
  const row = db.state.registrations[0];
  assert.equal(row.checkedInAt, null);
  assert.equal(row.checkInSource, null);
  assert.equal(row.checkInGroupId, null);
  assert.equal(row.personId, "p1");
  assert.equal(db.state.registrations.length, 1);
});

test("cancelCheckIn mengembalikan false untuk id yang tidak ada", async () => {
  assert.equal(await cancelCheckIn(fakeDb({ registrations: [] }), { registrationId: "nope", actorUserId: "admin1" }), false);
});
```

Run: FAIL.

- [ ] **Step 6: Implementasi `approveWalkInAccount` dan `cancelCheckIn` (GREEN)**

`approveWalkInAccount`: ambil `person` + `user`; bila `user` ada kembalikan `"ALREADY_HAS_ACCOUNT"`; hitung `deriveBaseUsername` lalu `loadTakenUsernames` (sama seperti `registrasi.ts`, ambil `user.findMany({ where: { username: { startsWith } } })`), `deriveUniqueUsername`, `bcrypt.hash(DEFAULT_REGISTRATION_PASSWORD, REGISTRATION_BCRYPT_ROUNDS)`, `user.create` dengan `mustChangeCredentials: true, isVerified: true, role: "MEMBER"`.

`cancelCheckIn`: `updateMany({ where: { id }, data: { checkedInAt: null, checkInSource: null, checkInGroupId: null } })`, kembalikan `count > 0`.

Run ulang: PASS.

- [ ] **Step 7: Suite penuh modul + typecheck**

```bash
npx tsx --test src/lib/buku-tamu.test.ts && npx tsc --noEmit && npx eslint src/lib/buku-tamu.ts src/lib/buku-tamu.test.ts
```

Expected: semua PASS, 0 error, eslint bersih.

- [ ] **Step 8: Commit**

```bash
git add src/lib/buku-tamu.ts src/lib/buku-tamu.test.ts
git commit -m "feat(buku-tamu): modul inti absen, walk-in, persetujuan akun, pembatalan"
```

---

### Task 3: Pembatas laju dan route publik

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`
- Create: `src/app/api/reuni/buku-tamu/lookup/route.ts`
- Create: `src/app/api/reuni/buku-tamu/lookup/route.test.ts`
- Create: `src/app/api/reuni/buku-tamu/route.ts`
- Create: `src/app/api/reuni/buku-tamu/route.test.ts`

**Interfaces:**
- Consumes: `lookupCandidates`, `checkIn`, `MIN_QUERY_LENGTH` dari Task 2; `REUNI_2027_SLUG` dari `@/lib/registrasi`.
- Produces: `GET /api/reuni/buku-tamu/lookup?q=&branchId=` -> `{ rows: LookupCandidate[] }`; `POST /api/reuni/buku-tamu` body `{ branchId, rows }` -> `{ ok: true, groupId, checkedIn, alreadyCheckedIn, created }`. Keduanya 429 saat melewati batas. Fungsi `consumeRateLimit(key, limit, windowMs)` dari `src/lib/rate-limit.ts`.

**Konteks:** Tidak ada klien Redis di `node_modules` meskipun `REDIS_URL` diset di compose. Pembatas laju disimpan di memori proses: cukup untuk satu instance aplikasi (compose menjalankan satu `wirjodihardjo-app`). Bila nanti ada lebih dari satu instance, ganti isi `rate-limit.ts` dengan `ioredis` tanpa mengubah pemanggil.

- [ ] **Step 1: Tulis tes pembatas laju (RED)**

```ts
test("consumeRateLimit mengizinkan sampai batas lalu menolak", () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < 30; i++) assert.equal(limiter.consume("ip-1", 30, 60_000), true);
  assert.equal(limiter.consume("ip-1", 30, 60_000), false);
});

test("consumeRateLimit memisahkan kunci yang berbeda", () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < 30; i++) limiter.consume("ip-1", 30, 60_000);
  assert.equal(limiter.consume("ip-2", 30, 60_000), true);
});

test("consumeRateLimit mengizinkan lagi setelah jendela lewat", () => {
  let now = 0;
  const limiter = createRateLimiter(() => now);
  for (let i = 0; i < 30; i++) limiter.consume("ip-1", 30, 60_000);
  now = 60_001;
  assert.equal(limiter.consume("ip-1", 30, 60_000), true);
});
```

Run: FAIL.

- [ ] **Step 2: Implementasi (GREEN)**

`createRateLimiter(now = Date.now)` mengembalikan `{ consume(key, limit, windowMs) }` memakai `Map<string, number[]>`. Setiap panggilan membuang stempel waktu di luar jendela. Satu modul, tanpa dependensi.

Run ulang: PASS.

- [ ] **Step 3: Tulis tes route lookup (RED)**

```ts
test("lookup menolak kata kunci satu huruf", async () => {
  const res = await GET(new Request("http://x/api/reuni/buku-tamu/lookup?q=a&branchId=b1"));
  assert.equal(res.status, 400);
});

test("lookup mengembalikan 429 setelah batas per IP", async () => {
  for (let i = 0; i < 30; i++) await GET(new Request("http://x/api/reuni/buku-tamu/lookup?q=wi&branchId=b1", { headers: { "x-forwarded-for": "9.9.9.9" } }));
  const res = await GET(new Request("http://x/api/reuni/buku-tamu/lookup?q=wi&branchId=b1", { headers: { "x-forwarded-for": "9.9.9.9" } }));
  assert.equal(res.status, 429);
});

test("lookup mengembalikan daftar kosong tanpa branchId", async () => {
  const res = await GET(new Request("http://x/api/reuni/buku-tamu/lookup?q=wi"));
  assert.equal(res.status, 400);
});
```

Run: FAIL.

- [ ] **Step 4: Implementasi route lookup (GREEN)**

Ambil IP dari `x-forwarded-for` (fallback `x-real-ip`, fallback `"unknown"`). `consumeRateLimit("lookup:" + ip, 30, 60_000)`. Validasi `q` (panjang >= `MIN_QUERY_LENGTH`) dan `branchId`. Cari `reunion` lewat `REUNI_2027_SLUG`; bila belum ada, tetap layani pencarian dengan `reunionId: null` dan `alreadyRegistered`/`checkedIn` bernilai `false`. Respons hanya memuat `LookupCandidate[]`.

Run ulang: PASS.

- [ ] **Step 5: Tulis tes route check-in (RED)**

```ts
test("POST buku tamu menolak kiriman tanpa baris", async () => {
  const res = await POST(json({ branchId: "b1", rows: [] }));
  assert.equal(res.status, 400);
});

test("POST buku tamu menolak cabang yang tidak aktif", async () => {
  const res = await POST(json({ branchId: "b-tidak-ada", rows: [{ personId: "p1" }] }));
  assert.equal(res.status, 400);
});

test("POST buku tamu mengembalikan groupId dan pemisahan checkedIn", async () => {
  const res = await POST(json({ branchId: "b1", rows: [{ personId: "p1" }, { personId: "p2" }] }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(typeof body.groupId, "string");
  assert.equal(body.checkedIn.length + body.alreadyCheckedIn.length, 2);
});
```

Run: FAIL.

- [ ] **Step 6: Implementasi route check-in (GREEN)**

Validasi `branchId` aktif (dan bukan `EXCLUDED_BRANCH_SLUG`), `rows` array 1..`MAX_ROWS_PER_GROUP`, tiap baris berbentuk `{ personId }` atau `{ fullName, namaPanggilan, gender }` dengan `gender` di `MALE|FEMALE|OTHER`. Panggil `checkIn(prisma, { reunionId, branchId, rows, source: "QR_SELF", actorUserId: null })`. Balas 201. Batas laju 10 kiriman per menit per IP.

Run ulang: PASS.

- [ ] **Step 7: Suite + typecheck + eslint + commit**

```bash
npx tsx --test src/lib/rate-limit.test.ts src/app/api/reuni/buku-tamu/route.test.ts src/app/api/reuni/buku-tamu/lookup/route.test.ts
npx tsc --noEmit && npx eslint src/lib/rate-limit.ts src/app/api/reuni/buku-tamu
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/api/reuni/buku-tamu
git commit -m "feat(buku-tamu): route publik pencarian dan absen dengan pembatas laju"
```

---

### Task 4: Halaman buku tamu `/reuni/buku-tamu`

**Files:**
- Create: `src/app/reuni/buku-tamu/page.tsx`
- Create: `src/app/reuni/buku-tamu/BukuTamuClient.tsx`
- Create: `src/app/reuni/buku-tamu/BukuTamuClient.test.ts`
- Modify: `src/app/reuni/page.tsx` (tautan ke buku tamu, hanya saat reuni terbit)

**Interfaces:**
- Consumes: `GET /api/reuni/buku-tamu/lookup`, `POST /api/reuni/buku-tamu` dari Task 3; `getRegistrationBranches` dari `@/lib/registrasi`.
- Produces: halaman publik. Fungsi murni `groupRowsByBranch(rows)`, `summarizeGroup(rows)`, `canSubmit(rows)` yang diuji.

**Konteks:** Wizard tiga langkah, satu kolom, target jari di ponsel: (1) pilih keluarga cabang, (2) cari nama dan tandai hadir, (3) tambah anggota rombongan. Setelah terkirim, tampilkan ringkasan rombongan dan tombol "Tambah orang lagi" untuk rombongan berikutnya. Nama yang tidak ditemukan menampilkan tombol "Tambah sebagai tamu baru" yang membuka tiga isian: nama lengkap, nama panggilan, jenis kelamin.

- [ ] **Step 1: Tulis tes fungsi bantu (RED)**

```ts
test("summarizeGroup menghitung terdaftar, sudah absen, dan tamu baru", () => {
  const rows = [
    { kind: "existing", checkedIn: false },
    { kind: "existing", checkedIn: true },
    { kind: "walkIn" },
  ];
  assert.deepEqual(summarizeGroup(rows), { total: 3, existing: 2, alreadyCheckedIn: 1, walkIn: 1 });
});

test("canSubmit menolak daftar kosong dan menerima minimal satu baris", () => {
  assert.equal(canSubmit([]), false);
  assert.equal(canSubmit([{ kind: "existing", personId: "p1" }]), true);
});

test("canSubmit menolak tamu baru tanpa nama lengkap", () => {
  assert.equal(canSubmit([{ kind: "walkIn", fullName: "", namaPanggilan: "Budi", gender: "MALE" }]), false);
});

test("groupRowsByBranch memisahkan baris menurut cabang pilihan tamu", () => {
  const grouped = groupRowsByBranch([{ branchId: "b1" }, { branchId: "b2" }, { branchId: "b1" }]);
  assert.deepEqual(Object.keys(grouped).sort(), ["b1", "b2"]);
  assert.equal(grouped.b1.length, 2);
});
```

Run: FAIL.

- [ ] **Step 2: Implementasi komponen dan halaman (GREEN)**

`page.tsx`: `export const dynamic = "force-dynamic"`, ambil `getRegistrationBranches(prisma)`, render header "Buku Tamu Reuni" + `BukuTamuClient`. Tanpa login, tanpa `proxy.ts` (matcher hanya `/dashboard` dan `/admin`).

`BukuTamuClient.tsx`: state `step`, `branchId`, `query`, `results`, `rows`. Pencarian dengan debounce 300 ms, minimal 2 huruf. Tiap hasil menampilkan nama panggilan, nama lengkap, cabang, dan lencana: "Sudah absen" (abu) atau "Terdaftar" (hijau muda) atau tanpa lencana. Tombol utama "Tandai hadir". Baris yang sudah absen tidak dapat ditambahkan lagi (tombol nonaktif, alasan tertulis). Kirim ke `POST`, lalu tampilkan ringkasan: "Rombongan tercatat: N orang" + daftar nama + catatan "Tamu baru akan dibuatkan akun setelah disetujui pengurus". A11y: setiap isian punya `label`, fokus berpindah ke hasil pertama setelah pencarian, tombol nonaktif memakai `aria-disabled` beserta teks alasan.

- [ ] **Step 3: Verifikasi di lingkungan lokal**

```bash
npm run build && npx tsx --test src/app/reuni/buku-tamu/BukuTamuClient.test.ts
```

Expected: build sukses, tes PASS. Lalu jalankan `npm run dev` dan periksa manual: pencarian "wi" menampilkan hasil, menandai hadir mengembalikan ringkasan, halaman dapat dipakai pada lebar 360 px tanpa gulir horizontal.

- [ ] **Step 4: Commit**

```bash
git add src/app/reuni/buku-tamu src/app/reuni/page.tsx
git commit -m "feat(buku-tamu): halaman publik absen kehadiran via QR"
```

---

### Task 5: QR code di panel admin reuni

**Files:**
- Modify: `package.json` (tambah `qrcode`, `@types/qrcode`)
- Create: `src/components/admin/BukuTamuQr.tsx`
- Create: `src/components/admin/BukuTamuQr.test.ts`
- Modify: `src/app/admin/reuni/[id]/page.tsx` (sisipkan panel QR)

**Interfaces:**
- Consumes: tidak ada dari task lain (hanya butuh `reunion.slug`).
- Produces: komponen server `BukuTamuQr({ url })` yang merender QR sebagai SVG inline plus tombol "Unduh PNG" dan "Cetak".

**Konteks:** Satu QR untuk semua cabang. URL: `${NEXTAUTH_URL}/reuni/buku-tamu`. `qrcode` dipilih karena menghasilkan SVG langsung di server tanpa dependensi native dan tanpa `canvas`; alternatif `qrcode.react` menambah komponen klien tanpa manfaat.

- [ ] **Step 1: Pasang dependensi**

```bash
npm install qrcode && npm install -D @types/qrcode
```

- [ ] **Step 2: Tulis tes (RED)**

```ts
test("buildCheckInUrl memakai NEXTAUTH_URL tanpa garis miring ganda", () => {
  assert.equal(buildCheckInUrl("https://wirjodihardjo.teknoloka.id/"), "https://wirjodihardjo.teknoloka.id/reuni/buku-tamu");
  assert.equal(buildCheckInUrl("https://wirjodihardjo.teknoloka.id"), "https://wirjodihardjo.teknoloka.id/reuni/buku-tamu");
});

test("renderQrSvg menghasilkan svg yang dapat disisipkan", async () => {
  const svg = await renderQrSvg("https://wirjodihardjo.teknoloka.id/reuni/buku-tamu");
  assert.match(svg, /^<svg/);
  assert.ok(svg.length > 200);
});
```

Run: FAIL.

- [ ] **Step 3: Implementasi (GREEN)**

`buildCheckInUrl(base)` dan `renderQrSvg(text)` (bungkus `QRCode.toString(text, { type: "svg", margin: 1, width: 512 })`). Komponen menampilkan QR, teks URL, dan tombol cetak (`window.print()` lewat komponen klien kecil) dengan gaya `print:` sehingga hanya QR yang tercetak.

Run ulang: PASS.

- [ ] **Step 4: Sisipkan ke halaman admin dan verifikasi**

Tambahkan panel di `/admin/reuni/[id]` di atas daftar pendaftaran. Jalankan `npx tsc --noEmit && npx eslint src/components/admin/BukuTamuQr.tsx && npm run build`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/admin/BukuTamuQr.tsx src/components/admin/BukuTamuQr.test.ts src/app/admin/reuni/[id]/page.tsx
git commit -m "feat(buku-tamu): QR code dan panel cetak di halaman admin reuni"
```

---

### Task 6: Panel admin rombongan dan persetujuan akun

**Files:**
- Create: `src/app/api/admin/reuni/checkin/route.ts`
- Create: `src/app/api/admin/reuni/checkin/route.test.ts`
- Create: `src/components/admin/BukuTamuRombongan.tsx`
- Modify: `src/app/admin/reuni/[id]/page.tsx`

**Interfaces:**
- Consumes: `approveWalkInAccount`, `cancelCheckIn` dari Task 2.
- Produces: `GET /api/admin/reuni/checkin?reunionId=` -> `{ groups: Array<{ groupId: string; checkedInAt: string; source: string; members: Array<{ registrationId: string; fullName: string; namaPanggilan: string | null; branchName: string | null; hasAccount: boolean }> }>, pendingAccounts: Array<{ personId: string; fullName: string; namaPanggilan: string | null; checkedInAt: string }> }`; `POST /api/admin/reuni/checkin` body `{ action: "approve-account", personId }` -> `{ ok: true, username }`; body `{ action: "cancel-checkin", registrationId }` -> `{ ok: true }`.

**Konteks:** Inilah status "anggota yang belum terdaftar" yang diminta: tamu baru hasil buku tamu yang belum punya akun. Daftar ini diturunkan dari data, bukan kolom baru: baris pendaftaran dengan `checkInSource = QR_SELF` yang `person.user`-nya kosong.

- [ ] **Step 1: Tulis tes route (RED)**

```ts
test("GET menolak pengunjung tanpa sesi", async () => {
  mockAuth(null);
  assert.equal((await GET(req("?reunionId=r1"))).status, 401);
});

test("GET menolak pengguna MEMBER", async () => {
  mockAuth({ id: "u1", role: "MEMBER" });
  assert.equal((await GET(req("?reunionId=r1"))).status, 403);
});

test("GET mengelompokkan anggota menurut checkInGroupId", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const body = await (await GET(req("?reunionId=r1"))).json();
  assert.equal(body.groups.length, 2);
  assert.equal(body.groups[0].members.length, 3);
});

test("GET menandai tamu baru yang belum punya akun", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const body = await (await GET(req("?reunionId=r1"))).json();
  assert.deepEqual(body.pendingAccounts.map((p) => p.fullName), ["Budi Santoso"]);
});

test("POST approve-account menulis audit log", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const res = await POST(json({ action: "approve-account", personId: "p9" }));
  assert.equal(res.status, 200);
  assert.equal(auditCalls[0].action, "buku-tamu.approve-account");
});

test("POST cancel-checkin menulis audit log dan tidak menghapus baris", async () => {
  mockAuth({ id: "u1", role: "SUPER_ADMIN" });
  const res = await POST(json({ action: "cancel-checkin", registrationId: "reg1" }));
  assert.equal(res.status, 200);
  assert.equal(auditCalls[0].action, "buku-tamu.cancel-checkin");
  assert.equal(db.state.registrations.length, 1);
});
```

Run: FAIL.

- [ ] **Step 2: Implementasi route (GREEN)**

Penjaga: `auth()` lalu `prisma.user.findUnique({ select: { role, isActive } })`; hanya `SUPER_ADMIN`/`BRANCH_ADMIN` aktif. `GET` mengambil `reunionRegistration.findMany({ where: { reunionId, checkedInAt: { not: null } }, include: { person: { select: { fullName, namaPanggilan, branch: {...}, user: { select: { id: true } } } } } })`, lalu mengelompokkan di memori menurut `checkInGroupId` (baris tanpa grup mendapat grup sintetis per `registrationId`). `POST` memanggil `approveWalkInAccount` atau `cancelCheckIn` lalu `logAudit` dengan `entityType: "ReunionRegistration"`.

Run ulang: PASS.

- [ ] **Step 3: Komponen `BukuTamuRombongan.tsx`**

Dua bagian: (1) "Perlu persetujuan akun" berisi daftar tamu baru dengan tombol "Setujui & buat akun" yang menampilkan nama pengguna hasilnya; (2) "Rombongan" berisi kartu per grup: judul `Rombongan #n`, waktu absen, jumlah orang, daftar nama dengan lencana "terdaftar" / "tamu baru", dan tombol "Batalkan absen" per anggota dengan konfirmasi.

- [ ] **Step 4: Verifikasi**

```bash
npx tsx --test src/app/api/admin/reuni/checkin/route.test.ts
npx tsc --noEmit && npx eslint src/app/api/admin/reuni/checkin src/components/admin/BukuTamuRombongan.tsx && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/reuni/checkin src/components/admin/BukuTamuRombongan.tsx src/app/admin/reuni/[id]/page.tsx
git commit -m "feat(buku-tamu): panel rombongan, persetujuan akun tamu baru, pembatalan absen"
```

---

### Task 7: Verifikasi menyeluruh dan deploy

**Files:** tidak ada berkas baru.

- [ ] **Step 1: Suite penuh**

```bash
npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx')
```

Expected: semua lulus. Catat jumlah: sebelumnya 600 tes (599 lulus, 1 skip). Jumlah baru harus lebih besar, 0 gagal.

- [ ] **Step 2: Typecheck, lint, build**

```bash
npx tsc --noEmit && npx eslint . && npm run build
```

Expected: 0 error, build sukses.

- [ ] **Step 3: Uji manual alur lengkap di lingkungan lokal**

Jalankan aplikasi dengan `DATABASE_URL` produksi hanya-baca atau salinan DB. Periksa berurutan: (a) QR di `/admin/reuni/[id]` terbaca oleh pemindai ponsel dan membuka `/reuni/buku-tamu`; (b) pilih cabang, cari nama anggota lama, tandai hadir, ringkasan muncul; (c) ulangi untuk nama yang sama, muncul "Sudah absen"; (d) tambah tamu baru, pastikan tidak ada akun dibuat; (e) di admin, tamu baru muncul di "Perlu persetujuan akun"; (f) setujui, akun dibuat, nama pengguna tampil; (g) batalkan absen satu anggota, pastikan baris pendaftaran masih ada dan lencana hilang.

- [ ] **Step 4: Deploy**

```bash
docker compose build wirjodihardjo-app
docker compose up -d wirjodihardjo-app
```

Tunggu container sehat, periksa log bersih, lalu:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://wirjodihardjo.teknoloka.id/reuni/buku-tamu
```

Expected: `200`.

- [ ] **Step 5: Push**

```bash
git push origin main
```

---

## Catatan Ruling (keputusan controller)

- **Semua orang lewat buku tamu**: pengguna menegaskan bahwa anggota lama, anggota existing, dan yang sudah mendaftar reuni tetap harus mengisi buku tamu. Karena itu `checkedInAt` dipisah dari `attendance` dan dari keberadaan baris pendaftaran. Bila salah: laporan kehadiran hari-H akan memasukkan orang yang tidak datang.
- **Akun tamu baru menunggu persetujuan**: pengguna memutuskan akun dibuat setelah admin menyetujui. Karena itu jalur buku tamu tidak pernah memanggil `user.create`; hanya `approveWalkInAccount` yang melakukannya, dan hanya dari panel admin. Bila salah: akun sampah menumpuk di basis data anggota.
- **Satu QR untuk semua**: cabang dipilih tamu di halaman. Bila salah: tamu harus memilih QR yang tepat di meja registrasi, memperlambat antrean.
- **Rombongan berlabel**: setiap kiriman buku tamu menghasilkan satu `checkInGroupId`. Bila salah: admin melihat daftar datar tanpa tahu siapa datang bersama siapa.
- **Pembatas laju di memori, bukan Redis**: tidak ada klien Redis di repositori meskipun `REDIS_URL` diset. Satu instance aplikasi berjalan di compose. Bila salah dan aplikasi diperbanyak: batas per IP menjadi batas per instance. Perbaikan: ganti isi `src/lib/rate-limit.ts` dengan `ioredis`.
- **Cabang dikecualikan tetap dikecualikan**: buku tamu memakai `EXCLUDED_BRANCH_SLUG` yang sama dengan form registrasi agar tidak ada jalan masuk kedua ke cabang yang sengaja disembunyikan. Bila salah: tamu dapat memilih cabang yang tidak ditawarkan di tempat lain.
