import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateImportData } from "./validate";
import { DEFAULT_IMPORT_PASSWORD } from "./types";
import type { ParsedData, ImportCounts, ImportCredential, ImportBatchPayload, ValidationError } from "./types";

export class ImportError extends Error {
  constructor(message: string, public status = 400, public errors: ValidationError[] = []) {
    super(message);
  }
}

function emptyCounts(data: ParsedData): ImportCounts {
  return { anggota: data.anggota.length, relasi: data.relasi.length, akun: data.akun.length,
    personsCreated: 0, personsUpdated: 0, accountsCreated: 0, accountsUpdated: 0,
    childEdgesCreated: 0, partnerEdgesCreated: 0, privateUpserts: 0 };
}

export async function analyzeImportData(data: ParsedData) {
  const people = await prisma.person.findMany({
    where: { externalRef: { in: data.anggota.map(r => r.ref) } }, select: { externalRef: true },
  });
  const users = await prisma.user.findMany({
    where: { email: { in: data.akun.map(r => r.email.toLowerCase()) } }, select: { email: true },
  });
  const existingRefs = new Set(people.map(p => p.externalRef));
  const emails = new Set(users.map(u => u.email.toLowerCase()));
  const counts = emptyCounts(data);
  counts.personsUpdated = data.anggota.filter(r => existingRefs.has(r.ref)).length;
  counts.personsCreated = data.anggota.length - counts.personsUpdated;
  const credentials: ImportCredential[] = data.akun.map(row => ({ ref: row.ref,
    fullName: data.anggota.find(p => p.ref === row.ref)?.namaLengkap ?? row.ref,
    email: row.email, role: row.peran || "MEMBER", isNew: !emails.has(row.email.toLowerCase()) }));
  counts.accountsCreated = credentials.filter(c => c.isNew).length;
  counts.accountsUpdated = credentials.length - counts.accountsCreated;
  counts.childEdgesCreated = data.relasi.filter(r => r.jenisRelasi === "ORANG_TUA").length;
  counts.partnerEdgesCreated = data.relasi.length - counts.childEdgesCreated;
  return { counts, credentials, existingRefs };
}

function rowError(sheet: ValidationError["sheet"], row: number, field: string, message: string): never {
  throw new ImportError(message, 400, [{ sheet, row, field, message }]);
}

function date(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return new Date(match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}T00:00:00Z` : `${value}T00:00:00Z`);
}
function truth(value?: string) { return ["ya", "yes", "true", "1", "y"].includes(value?.toLowerCase() ?? ""); }

async function applyData(tx: Prisma.TransactionClient, data: ParsedData, actorId: string, passwordHash: string) {
  const counts = emptyCounts(data);
  const credentials: ImportCredential[] = [];
  const ids = new Map<string, string>();
  for (const [index, row] of data.anggota.entries()) {
    const rowNo = row._row ?? index + 2;
    const existing = await tx.person.findUnique({ where: { externalRef: row.ref } });
    if (existing?.deletedAt) rowError("Anggota", rowNo, "ref", "Anggota diarsipkan. Pulihkan terlebih dahulu.");
    let branchId: string | undefined;
    if (row.cabang) {
      const branch = await tx.branch.findFirst({ where: { isActive: true, OR: [
        { name: { equals: row.cabang, mode: "insensitive" } }, { slug: row.cabang },
      ] } });
      if (!branch) rowError("Anggota", rowNo, "cabang", `Cabang "${row.cabang}" tidak ditemukan.`);
      branchId = branch.id;
    }
    // Empty optional cells preserve existing data; clearing a field is an explicit edit outside import.
    const values = { fullName: row.namaLengkap, gender: row.jenisKelamin,
      nickname: row.namaPanggilan || undefined, birthDate: date(row.tanggalLahir),
      birthPlace: row.tempatLahir || undefined, deathDate: date(row.tanggalMeninggal),
      isDeceased: row.tanggalMeninggal ? true : row.meninggal ? truth(row.meninggal) : undefined,
      bio: row.bio || undefined, generationLevel: row.levelGenerasi ? Number(row.levelGenerasi) : undefined, branchId };    const person = existing
      ? await tx.person.update({ where: { id: existing.id }, data: values })
      : await tx.person.create({ data: { ...values, externalRef: row.ref } });
    ids.set(row.ref, person.id);
    if (existing) counts.personsUpdated++; else counts.personsCreated++;
    const privateData = { addressLine: row.alamat || undefined, city: row.kota || undefined,
      province: row.provinsi || undefined, postalCode: row.kodePos || undefined, phone: row.telepon || undefined,
      whatsapp: row.whatsapp || undefined, email: row.email || undefined,
      maritalStatus: row.statusPernikahan || undefined, familyNotes: row.catatanKeluarga || undefined };
    if (Object.values(privateData).some(Boolean)) {
      await tx.personPrivate.upsert({ where: { personId: person.id }, update: privateData,
        create: { personId: person.id, ...privateData } });
      counts.privateUpserts++;
    }
  }
  const resolve = (ref: string, sheet: ValidationError["sheet"], rowNo: number) => {
    const id = ids.get(ref);
    if (!id) rowError(sheet, rowNo, "ref", `Ref "${ref}" tidak ditemukan dalam Anggota.`);
    return id;
  };
  const edges = await tx.personChild.findMany({ select: { parentId: true, childId: true } });
  const parents = new Map<string, Set<string>>();
  for (const edge of edges) {
    const set = parents.get(edge.childId) ?? new Set<string>();
    set.add(edge.parentId); parents.set(edge.childId, set);
  }
  for (const [index, row] of data.relasi.entries()) {
    const n = row._row ?? index + 2;
    const child = resolve(row.refOrang, "Relasi", n), target = resolve(row.refTarget, "Relasi", n);
    if (child === target) rowError("Relasi", n, "ref_target", "Relasi diri sendiri tidak diperbolehkan.");
    if (row.jenisRelasi === "ORANG_TUA") {
      const current = parents.get(child) ?? new Set<string>();
      if (current.has(target)) continue;
      if (current.size >= 2) rowError("Relasi", n, "ref_target", "Anggota sudah memiliki dua orang tua.");
      const queue = [target], seen = new Set<string>();
      while (queue.length) {
        const node = queue.pop()!;
        if (node === child) rowError("Relasi", n, "ref_target", "Relasi membentuk siklus silsilah.");
        if (seen.has(node)) continue;
        seen.add(node); queue.push(...(parents.get(node) ?? []));
      }
      await tx.personChild.create({ data: { parentId: target, childId: child,
        parentRole: row.peranOrangTua || "UNKNOWN", isAdopted: truth(row.adopsi), isStep: truth(row.tiri) } });
      current.add(target); parents.set(child, current); counts.childEdgesCreated++;
    } else {
      const existing = await tx.personPartner.findFirst({ where: { OR: [
        { partnerAId: child, partnerBId: target }, { partnerAId: target, partnerBId: child },
      ] } });
      if (existing) continue;
      const [a, b] = [child, target].sort();
      await tx.personPartner.create({ data: { partnerAId: a, partnerBId: b,
        status: row.statusPasangan || "UNKNOWN", marriageDate: date(row.tanggalMenikah) } });
      counts.partnerEdgesCreated++;
    }
  }
  for (const [index, row] of data.akun.entries()) {
    const n = row._row ?? index + 2, personId = resolve(row.ref, "Akun", n);
    const existing = await tx.user.findFirst({ where: { email: { equals: row.email, mode: "insensitive" } } });
    const personUser = await tx.user.findUnique({ where: { personId } });
    if ((existing && existing.personId !== personId) || (personUser && personUser.id !== existing?.id)) {
      rowError("Akun", n, "email_akun", "Email atau anggota sudah terhubung ke akun berbeda.");
    }
    if (existing) {
      if (existing.id === actorId && row.peran !== "SUPER_ADMIN") rowError("Akun", n, "peran", "Tidak dapat menurunkan peran akun sendiri melalui impor.");
      await tx.user.update({ where: { id: existing.id }, data: { role: row.peran } });
      counts.accountsUpdated++;
    } else {
      await tx.user.create({ data: { personId, email: row.email.toLowerCase(), role: row.peran || "MEMBER",
        passwordHash, mustChangePassword: true, isVerified: true, createdById: actorId } });
      counts.accountsCreated++;
    }
    credentials.push({ ref: row.ref, email: row.email, role: row.peran || "MEMBER", isNew: !existing,
      fullName: data.anggota.find(p => p.ref === row.ref)!.namaLengkap });
  }
  return { counts, credentials };
}

export async function commitImportData(batchId: string, actorId: string) {
  const passwordHash = await bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
  try {
    return await prisma.$transaction(async tx => {
      // The row lock serializes retries of one batch; serializable isolation protects overlapping batches.
      await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;
      const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new ImportError("Batch tidak ditemukan.", 404);
      if (batch.status !== "VALIDATED") throw new ImportError("Batch sudah diproses.", 409);
      const user = await tx.user.findUnique({ where: { id: actorId } });
      if (!user?.isActive || user.role !== "SUPER_ADMIN" || user.mustChangePassword) throw new ImportError("Akses impor ditolak.", 403);
      const payload = batch.reportJson as ImportBatchPayload | null;
      if (!payload?.data) throw new ImportError("Data batch tidak lengkap.");
      const validation = validateImportData(payload.data);
      if (payload.errors?.length || !validation.valid) {
        throw new ImportError("Perbaiki file dan unggah ulang.", 400, validation.errors.length ? validation.errors : payload.errors);
      }
      const result = await applyData(tx, validation.data, actorId, passwordHash);
      await tx.importBatch.update({ where: { id: batchId }, data: { status: "COMMITTED",
        successRows: validation.data.anggota.length + validation.data.relasi.length + validation.data.akun.length,
        errorRows: 0, reportJson: { ...payload, ...result, errors: [] } } });
      await tx.auditLog.create({ data: { action: "IMPORT_COMMIT", entityType: "ImportBatch",
        entityId: batchId, actorUserId: actorId, afterData: result.counts } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 10_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new ImportError("Data sedang diubah oleh proses lain. Muat ulang laporan sebelum mencoba lagi.", 409);
    }
    // Failure leaves the batch VALIDATED and all person/account writes rolled back, so retry remains safe.
    throw error;
  }
}
