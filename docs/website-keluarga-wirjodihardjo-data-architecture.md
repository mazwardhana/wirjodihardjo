# Arsitektur Data & Skema Database: Website Keluarga Wirjodihardjo

**Version**: 1.0
**Date**: 25 September 2026
**Pendamping**: PRD v1.0
**Stack**: PostgreSQL + Prisma ORM

---

## 1. Prinsip Desain Data

1. **Person-centric, relation-based.** Individu disimpan sekali (`Person`); hubungan kekerabatan disimpan sebagai relasi terpisah, bukan sebagai kolom di `Person`. Ini wajib karena satu orang bisa punya dua orang tua, banyak anak, dan pasangan.
2. **Generation dihitung, bukan diketik.** `generationLevel` adalah nilai turunan (jarak dari akar keluarga), disimpan sebagai cache untuk kecepatan query dan filter, tapi sumber kebenarannya adalah rantai relasi.
3. **Privasi di level data, bukan UI.** Data pribadi dipisah ke tabel `PersonPrivate` supaya query publik tidak pernah menyentuhnya.
4. **Tidak ada perubahan langsung ke pohon.** Semua penambahan/ubah relasi melewati `Submission` yang divalidasi admin.
5. **Jejak audit.** Setiap keputusan admin dicatat di `AuditLog`.

---

## 2. Diagram Relasi Tingkat Tinggi

```
Branch (cabang, 10 anak)
   │ 1
   │
   ▼ N
Person ────────────────< PersonPrivate (1:1, data sensitif)
   │  │
   │  │ 1
   │  ▼ N
   │ PersonChild (parent-child edges)     PersonPartner (marriage edges)
   │
   ├──< User (akun, 1:1 opsional)
   ├──< Submission (pengajuan, target/source)
   ├──< HallOfFameEntry
   └──< GalleryMedia

User ──< Submission (submitter/reviewer)
User ──< ReunionRegistration ──> Reunion
User ──< Notification
Album ──< GalleryMedia
```

Catatan: `Person` dan `User` dipisah. Tidak semua `Person` punya akun (anggota yang belum/tidak aktif), dan akun selalu terhubung ke satu `Person`.

---

## 3. Entitas & Field

### 3.1 `Branch` (Cabang)
Merepresentasikan salah satu dari 10 garis keturunan anak Tn. & Ny. Wirjodihardjo.

| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| name | String | mis. "Cabang Ki A" |
| slug | String (unique) | untuk URL |
| rootPersonId | UUID (FK → Person) | anak yang menjadi akar cabang |
| description | Text? | sejarah singkat cabang |
| coverImageUrl | String? | |
| adminUserId | UUID? (FK → User) | admin cabang |
| createdAt / updatedAt | DateTime | |

**Index**: `slug` unique, `rootPersonId`.

### 3.2 `Person` (Anggota Keluarga)
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| fullName | String | |
| nickname | String? | nama panggilan, untuk search |
| gender | Enum(MALE/FEMALE/OTHER) | |
| birthDate | Date? | hanya bulan/tahun jika tidak lengkap |
| birthDatePrecision | Enum(DAY/MONTH/YEAR) | menangani data tidak lengkap |
| birthPlace | String? | |
| deathDate | Date? | |
| isDeceased | Boolean | default false |
| bio | Text? | publik |
| photoUrl | String? | publik |
| generationLevel | Int? | cache jarak dari akar (0 = pendiri) |
| branchId | UUID? (FK → Branch) | cabang utama |
| isPublicProfile | Boolean | default true (field publik saja) |
| createdById | UUID? (FK → User) | |
| createdAt / updatedAt | DateTime | |

**Index**: `fullName`, `branchId`, `generationLevel`, `isDeceased`. Search index: GIN pada `tsvector(fullName || nickname)` + `pg_trgm` untuk fuzzy.

### 3.3 `PersonPrivate` (Data Sensitif, 1:1)
| Field | Tipe | Catatan |
|-------|------|---------|
| personId | UUID (PK, FK → Person) | |
| addressLine | Text? | alamat lengkap |
| city / province / postalCode | String? | |
| phone | String? | |
| whatsapp | String? | |
| email | String? | |
| maritalStatus | Enum? | |
| familyNotes | Text? | catatan internal keluarga |
| visibleToMembers | Boolean | default true; jika false, hanya diri sendiri & admin |
| updatedAt | DateTime | |

**Aturan akses**: hanya dikembalikan oleh endpoint terautentikasi. Tidak pernah ikut query publik.

### 3.4 `PersonChild` (Relasi Orang Tua → Anak)
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| parentId | UUID (FK → Person) | |
| childId | UUID (FK → Person) | |
| parentRole | Enum(FATHER/MOTHER/UNKNOWN) | |
| isAdopted | Boolean | default false |
| sourceSubmissionId | UUID? (FK → Submission) | asal validasi |
| createdAt | DateTime | |

**Index**: `(parentId)`, `(childId)`, unique `(parentId, childId)`.
**Aturan**: maksimal 2 parent per child (1 father, 1 mother) ditegakkan di application layer + partial unique index.

### 3.5 `PersonPartner` (Relasi Pernikahan/Pasangan)
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| partnerAId / partnerBId | UUID (FK → Person) | |
| marriageDate | Date? | |
| status | Enum(MARRIED/DIVORCED/WIDOWED/UNKNOWN) | |
| createdAt | DateTime | |

**Index**: unique `(partnerAId, partnerBId)`.

### 3.6 `User` (Akun)
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| email | String (unique) | |
| passwordHash | String | bcrypt/argon2 |
| role | Enum(SUPER_ADMIN/BRANCH_ADMIN/MEMBER) | |
| personId | UUID (FK → Person, unique) | 1 akun = 1 orang |
| branchId | UUID? (FK → Branch) | wajib untuk BRANCH_ADMIN |
| isVerified | Boolean | |
| isActive | Boolean | |
| lastLoginAt | DateTime? | |
| createdAt / updatedAt | DateTime | |

### 3.7 `Submission` (Pengajuan Perubahan)
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| type | Enum(ADD_CHILD, ADD_SPOUSE, ADD_PERSON, EDIT_PERSON, EDIT_RELATION) | |
| submittedByUserId | UUID (FK → User) | |
| targetPersonId | UUID? (FK → Person) | orang yang jadi acuan relasi |
| payload | JSONB | data orang baru / perubahan |
| status | Enum(PENDING/APPROVED/REJECTED/CANCELLED) | |
| reviewedByUserId | UUID? (FK → User) | |
| reviewNote | Text? | alasan approve/reject |
| reviewedAt | DateTime? | |
| createdAt | DateTime | |

**Index**: `status`, `submittedByUserId`, `(targetPersonId)`.
**Aturan**: saat `APPROVED`, service membuat/ mengubah `Person` + relasi dalam satu transaksi, lalu menulis `AuditLog`.

### 3.8 `Album` & `GalleryMedia`
`Album`: id, title, slug, description, eventDate, coverImageUrl, createdByUserId, isPublished, createdAt.

`GalleryMedia`: id, albumId (FK), url, thumbnailUrl, caption, mediaType (IMAGE/VIDEO), uploadedByUserId, status (PENDING/APPROVED/REJECTED), width/height, createdAt.
**Index**: `albumId`, `status`.

### 3.9 `HallOfFameEntry`
| Field | Tipe | Catatan |
|-------|------|---------|
| id | UUID (PK) | |
| personId | UUID (FK → Person) | |
| category | String | mis. Pendidikan, Karier, Pengabdian |
| title | String | |
| description | Text | |
| year | Int? | |
| photoUrl | String? | |
| entryType | Enum(ACHIEVEMENT/IN_MEMORIAM) | |
| isPublished | Boolean | |
| createdByUserId | UUID (FK → User) | |
| createdAt | DateTime | |

**Aturan**: hanya admin yang membuat; wajib data nyata (PRD R-38).

### 3.10 `Reunion` & `ReunionRegistration`
`Reunion`: id, title, slug, description, startAt, endAt, locationName, locationUrl, capacity, registrationDeadline, status (DRAFT/PUBLISHED/CANCELLED/COMPLETED), heroImageUrl, createdByUserId, createdAt.

`ReunionRegistration`: id, reunionId (FK), userId (FK), guestCount, notes, status (CONFIRMED/CANCELLED/WAITLIST), createdAt.
**Index**: unique `(reunionId, userId)`.

### 3.11 `Notification`
id, userId (FK), type, title, body, link, isRead, createdAt. **Index**: `(userId, isRead)`.

### 3.12 `AuditLog`
id, actorUserId (FK), action, entityType, entityId, beforeData (JSONB), afterData (JSONB), createdAt. **Index**: `(entityType, entityId)`, `createdAt`.

### 3.13 `GenerationLabel` (Seed)
| level | jawa | indonesia |
|-------|------|-----------|
| 0 | Leluhur/Pendiri | pendiri keluarga |
| 1 | Anak | anak |
| 2 | Putu / Wayah | cucu |
| 3 | Buyut | cicit |
| 4 | Canggah | piut |
| 5 | Wareng | anggas |
| 6 | Udheg-udheg | - |
| 7 | Gantung siwur | - |
| 8 | Gropak senthe | - |
| 9 | Debog bosok | - |
| 10 | Galih asem | - |
| 11 | Gropak waton | - |
| 12 | Cendheng | - |
| 13 | Giyeng | - |
| 14 | Cumpleng | - |
| 15 | Ampleng | - |
| 16 | Menyaman | - |
| 17 | Menya-menya | - |
| 18 | Trah tumerah | - |

Di luar 18: tampilkan "Generasi ke-N" (fallback), sesuai PRD.

---

## 4. Strategi Query Silsilah (Performa 1K-5K Simpul)

1. **Adjacency list** (`PersonChild`) sebagai sumber kebenaran.
2. **Recursive CTE** untuk ambil subtree/cabang tertentu, dengan batas kedalaman saat render.
3. **`generationLevel` cache** memungkinkan filter generasi tanpa traversal.
4. **Closure table opsional** (`PersonClosure`: ancestorId, descendantId, depth) bila query leluhur/keturunan penuh mulai lambat. Isi ulang via trigger/service saat relasi berubah.
5. **Pemuatan bertahap**: API mengembalikan per-cabang/per-kedalaman; klien memuat node saat dibuka (lazy).
6. **Search**: `tsvector` + `pg_trgm`; hasil maksimal 20 dengan highlight.
7. **Cache**: hasil subtree cabang di-cache (Redis atau Next.js `unstable_cache`) dengan invalidasi saat ada approval.

**Aturan perhitungan `generationLevel`**: saat relasi parent-child dibuat/disetujui, hitung `childLevel = max(parentLevels) + 1`. Bila orang tua tidak diketahui, `generationLevel` bisa null dan diperlakukan sebagai cabang lepas.

---

## 5. Aturan Integritas & Validasi

- Satu `Person` maksimal 2 orang tua (1 ayah, 1 ibu).
- Anti-siklus: menolak relasi yang membuat orang menjadi leluhur dirinya sendiri.
- Deteksi duplikat: `fullName` mirip (trigram) + `birthDate` sama dalam satu orang tua → tolak/peringatkan.
- `User.personId` unique: satu akun hanya untuk satu orang.
- Hapus `Person` hanya boleh Super Admin, dan harus memutus relasi dengan benar (soft delete disarankan: `deletedAt`).
- Semua perubahan relasi wajib punya `sourceSubmissionId`.

---

## 6. Matriks Otorisasi (RBAC)

| Aksi | Publik | Member | Branch Admin | Super Admin |
|------|:------:|:------:|:------------:|:-----------:|
| Lihat field publik Person | ✅ | ✅ | ✅ | ✅ |
| Lihat field privat Person | ❌ | ✅* | ✅ | ✅ |
| Ajukan tambah/ubah anggota | ❌ | ✅ | ✅ | ✅ |
| Setujui pengajuan (cabangnya) | ❌ | ❌ | ✅ | ✅ |
| Setujui lintas cabang | ❌ | ❌ | ❌ | ✅ |
| Edit data master Person | ❌ | ❌ | ⚠️ terbatas | ✅ |
| Kelola cabang & peran user | ❌ | ❌ | ❌ | ✅ |
| Moderasi galeri | ❌ | ❌ | ✅ | ✅ |
| Kelola Hall of Fame, Reuni | ❌ | ❌ | ✅ | ✅ |
| Lihat Audit Log | ❌ | ❌ | ⚠️ cabangnya | ✅ |

\* Member melihat data privat anggota lain hanya jika `visibleToMembers = true`.

---

## 7. Contoh Skema Prisma (ringkas)

```prisma
enum Role { SUPER_ADMIN BRANCH_ADMIN MEMBER }
enum Gender { MALE FEMALE OTHER }
enum ParentRole { FATHER MOTHER UNKNOWN }
enum SubmissionType { ADD_CHILD ADD_SPOUSE ADD_PERSON EDIT_PERSON EDIT_RELATION }
enum SubmissionStatus { PENDING APPROVED REJECTED CANCELLED }
enum MediaStatus { PENDING APPROVED REJECTED }
enum ReunionStatus { DRAFT PUBLISHED CANCELLED COMPLETED }

model Person {
  id              String   @id @default(uuid())
  fullName        String
  nickname        String?
  gender          Gender
  birthDate       DateTime?
  birthDatePrecision String?
  birthPlace      String?
  deathDate       DateTime?
  isDeceased      Boolean  @default(false)
  bio             String?
  photoUrl        String?
  generationLevel Int?
  branchId        String?
  isPublicProfile Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  branch    Branch?       @relation(fields: [branchId], references: [id])
  private   PersonPrivate?
  parents   PersonChild[] @relation("asChild")
  children  PersonChild[] @relation("asParent")

  @@index([fullName])
  @@index([branchId])
  @@index([generationLevel])
}

model PersonChild {
  id         String     @id @default(uuid())
  parentId   String
  childId    String
  parentRole ParentRole @default(UNKNOWN)
  isAdopted  Boolean    @default(false)
  createdAt  DateTime   @default(now())

  parent Person @relation("asParent", fields: [parentId], references: [id])
  child  Person @relation("asChild", fields: [childId], references: [id])

  @@unique([parentId, childId])
  @@index([childId])
}
```

---

## 8. Seed Data Awal

- 1 `GenerationLabel` 1..18.
- 1 `Person` pasangan pendiri (Tn. & Ny. Wirjodihardjo) sebagai akar, `generationLevel = 0`.
- 10 `Person` anak (generationLevel = 1) + relasi ke akar.
- 10 `Branch`, masing-masing `rootPersonId` = salah satu anak.
- 1 `User` Super Admin (dibuat manual, bukan lewat registrasi publik).

Data selanjutnya diisi lewat pengajuan bertahap per cabang (sesuai mitigasi risiko PRD).