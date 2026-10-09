import assert from "node:assert/strict";
import test from "node:test";
import {
  lookupCandidates,
  checkIn,
  approveWalkInAccount,
  cancelCheckIn,
  MAX_LOOKUP_RESULTS,
  MAX_ROWS_PER_GROUP,
  type CheckInDb,
  type CheckInRowInput,
} from "./buku-tamu";



function fakeDb(overrides?: {
  customTxReunionRegCreate?: (args: unknown) => Promise<{ id: string }>;
}): {
  db: CheckInDb;
  captured: Record<string, unknown>[];
  persons: { id: string; fullName: string; namaPanggilan: string | null; gender: string; branchId: string | null; deletedAt: Date | null }[];
  registrations: { id: string; reunionId: string; personId: string; checkedInAt: Date | null; checkInSource: string | null; checkInGroupId: string | null; status: string; attendance: string; guestCount: number }[];
  users: { id: string; personId: string; username: string }[];
} {
  const captured: Record<string, unknown>[] = [];
  const persons: { id: string; fullName: string; namaPanggilan: string | null; gender: string; branchId: string | null; deletedAt: Date | null }[] = [];
  const registrations: { id: string; reunionId: string; personId: string; checkedInAt: Date | null; checkInSource: string | null; checkInGroupId: string | null; status: string; attendance: string; guestCount: number }[] = [];
  const users: { id: string; personId: string; username: string }[] = [];

  const tx = {
    person: {
      findFirst: async (args: unknown) => {
        captured.push({ kind: "person.findFirst", args });
        const a = args as { where: { fullName?: string; branchId?: string; deletedAt?: Date | null } };
        const found = persons.find(
          (p) =>
            (!a.where.fullName || p.fullName === a.where.fullName) &&
            (!a.where.branchId || p.branchId === a.where.branchId) &&
            p.deletedAt === null,
        );
        return found ?? null;
      },
      create: async (args: unknown) => {
        captured.push({ kind: "person.create", args });
        const a = args as { data: { fullName: string; namaPanggilan: string; gender: string; branchId: string } };
        const id = `p-${a.data.fullName}-${Date.now()}`;
        persons.push({ id, fullName: a.data.fullName, namaPanggilan: a.data.namaPanggilan, gender: a.data.gender, branchId: a.data.branchId, deletedAt: null });
        return { id };
      },
    },
    reunionRegistration: {
      findFirst: async (args: unknown) => {
        captured.push({ kind: "reg.findFirst", args });
        const a = args as { where: { reunionId?: string; personId?: string } };
        const found = registrations.find(
          (r) => r.reunionId === a.where.reunionId && r.personId === a.where.personId,
        );
        return found ?? null;
      },
      findMany: async (args: unknown) => {
        captured.push({ kind: "reg.findMany", args });
        const a = args as { where: { reunionId?: string; personId?: { in?: string[] } } };
        if (a.where?.personId?.in) {
          return registrations.filter((r) => a.where.reunionId === r.reunionId && a.where.personId!.in!.includes(r.personId));
        }
        return [];
      },
      update: async (args: unknown) => {
        captured.push({ kind: "reg.update", args });
        const a = args as { where: { id: string }; data: Record<string, unknown> };
        const reg = registrations.find((r) => r.id === a.where.id);
        if (reg) {
          if (a.data.checkedInAt !== undefined) reg.checkedInAt = a.data.checkedInAt as Date;
          if (a.data.checkInSource !== undefined) reg.checkInSource = a.data.checkInSource as string;
          if (a.data.checkInGroupId !== undefined) reg.checkInGroupId = a.data.checkInGroupId as string;
          if (a.data.attendance !== undefined) reg.attendance = a.data.attendance as string;
        }
        return reg ?? { id: a.where.id };
      },
      create: overrides?.customTxReunionRegCreate ?? (async (args: unknown) => {
        captured.push({ kind: "reg.create", args });
        const a = args as { data: { reunionId: string; personId: string; status: string; attendance: string; guestCount: number; checkedInAt: Date; checkInSource: string; checkInGroupId: string } };
        const id = `reg-${a.data.personId}`;
        registrations.push({
          id,
          reunionId: a.data.reunionId,
          personId: a.data.personId,
          checkedInAt: a.data.checkedInAt,
          checkInSource: a.data.checkInSource,
          checkInGroupId: a.data.checkInGroupId,
          status: a.data.status,
          attendance: a.data.attendance,
          guestCount: a.data.guestCount,
        });
        return { id };
      }),
      updateMany: async (args: unknown) => {
        captured.push({ kind: "reg.updateMany", args });
        const a = args as { where: { id?: string; checkInGroupId?: string }; data: Record<string, unknown> };
        const matching = registrations.filter((r) => {
          if (a.where.id && r.id !== a.where.id) return false;
          if (a.where.checkInGroupId && r.checkInGroupId !== a.where.checkInGroupId) return false;
          return true;
        });
        for (const reg of matching) {
          if (a.data.checkedInAt !== undefined) reg.checkedInAt = a.data.checkedInAt as Date;
          if (a.data.checkInSource !== undefined) reg.checkInSource = a.data.checkInSource as string;
          if (a.data.checkInGroupId !== undefined) reg.checkInGroupId = a.data.checkInGroupId as string;
        }
        return { count: matching.length };
      },
    },
    user: {
      findMany: async () => [],
      create: async (args: unknown) => {
        captured.push({ kind: "user.create", args });
        const a = args as { data: { username: string; personId: string } };
        const id = `u-${a.data.username}`;
        users.push({ id, personId: a.data.personId, username: a.data.username });
        return { id };
      },
    },
  };

  const db = {
    person: {
      findMany: async (args: unknown) => {
        captured.push({ kind: "db.person.findMany", args });
        const a = args as { take?: number };
        const result = a.take ? persons.slice(0, a.take) : persons;
        return result.map((p) => ({
          ...p,
          branch: { name: "Keluarga Soedjinah", branchNumber: 1 },
        }));
      },
      findFirst: tx.person.findFirst,
      create: tx.person.create,
    },
    branch: { findUnique: async () => ({ id: "b1", name: "Keluarga Soedjinah", branchNumber: 1 }) },
    reunion: { findUnique: async () => ({ id: "reunion-1" }) },
    reunionRegistration: {
      findFirst: tx.reunionRegistration.findFirst,
      findMany: tx.reunionRegistration.findMany,
      update: tx.reunionRegistration.update,
      create: tx.reunionRegistration.create,
      updateMany: tx.reunionRegistration.updateMany,
    },
    user: {
      findFirst: async (args: unknown) => {
        const a = args as { where: { personId?: string } };
        return users.find((u) => u.personId === a.where.personId) ?? null;
      },
      findMany: tx.user.findMany,
      create: tx.user.create,
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as CheckInDb;

  return { db, captured, persons, registrations, users };
}

test("lookup menolak q < 2 huruf tanpa query DB", async () => {
  const { db } = fakeDb();
  await assert.rejects(
    lookupCandidates(db, { reunionId: "r-1", branchId: "b-1", q: "a" }),
    /QUERY_TOO_SHORT/,
  );
});

test("lookup menandai alreadyRegistered + checkedIn false bila ada reg tanpa checkedInAt", async () => {
  const { db, persons } = fakeDb();
  persons.push({
    id: "p-1",
    fullName: "Budi Santoso",
    namaPanggilan: "Budi",
    gender: "MALE",
    branchId: "b-1",
    deletedAt: null,
  });
  db.person.findMany = async () => [
    { id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", branch: { name: "Keluarga Soedjinah", branchNumber: 1 } },
  ];
  db.reunionRegistration.findMany = async () => [
    { id: "reg-1", checkedInAt: null, personId: "p-1" },
  ];
  const results = await lookupCandidates(db, { reunionId: "r-1", branchId: "b-1", q: "Budi" });
  assert.equal(results.length, 1);
  assert.equal(results[0].personId, "p-1");
  assert.equal(results[0].alreadyRegistered, true);
  assert.equal(results[0].checkedIn, false);
});

test("lookup menandai checkedIn true bila checkedInAt terisi", async () => {
  const { db } = fakeDb();
  db.person.findMany = async () => [
    { id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", branch: { name: "Keluarga Soedjinah", branchNumber: 1 } },
  ];
  db.reunionRegistration.findMany = async () => [
    { id: "reg-1", checkedInAt: new Date(), personId: "p-1" },
  ];
  const results = await lookupCandidates(db, { reunionId: "r-1", branchId: "b-1", q: "Budi" });
  assert.equal(results.length, 1);
  assert.equal(results[0].alreadyRegistered, true);
  assert.equal(results[0].checkedIn, true);
});

test("lookup tidak return > MAX_LOOKUP_RESULTS dan fieldnya persis", async () => {
  const { db, persons } = fakeDb();
  for (let i = 0; i < MAX_LOOKUP_RESULTS + 5; i++) {
    persons.push({
      id: `p-${i}`,
      fullName: `Person ${i}`,
      namaPanggilan: `P ${i}`,
      gender: i % 2 === 0 ? "MALE" : "FEMALE",
      branchId: "b-1",
      deletedAt: null,
    });
  }
  db.reunionRegistration.findMany = async () => [];
  const results = await lookupCandidates(db, { reunionId: "r-1", branchId: "b-1", q: "Person" });
  assert.ok(results.length <= MAX_LOOKUP_RESULTS);
  for (const r of results) {
    assert.equal(typeof r.personId, "string");
    assert.equal(typeof r.fullName, "string");
    assert.ok(r.gender === "MALE" || r.gender === "FEMALE" || r.gender === "OTHER");
    assert.ok(typeof r.alreadyRegistered === "boolean");
    assert.ok(typeof r.checkedIn === "boolean");
    assert.equal("phone" in r, false);
    assert.equal("email" in r, false);
  }
});

test("checkIn mengisi checkedInAt pada reg yang sudah ada (alumni lama)", async () => {
  const { db, registrations, persons } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  registrations.push({ id: "reg-1", reunionId: "r-1", personId: "p-1", checkedInAt: null, checkInSource: null, checkInGroupId: null, status: "CONFIRMED", attendance: "ATTENDING", guestCount: 1 });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, { reunionId: "r-1", branchId: "b-1", rows: [{ personId: "p-1" }], source: "QR_SELF" as const, actorUserId: "u-admin" });

  assert.ok(result.groupId);
  assert.deepEqual(result.checkedIn, ["p-1"]);
  assert.deepEqual(result.alreadyCheckedIn, []);
  assert.ok(registrations[0].checkedInAt !== null);
  assert.equal(registrations[0].checkInSource, "QR_SELF");
  assert.equal(registrations[0].checkInGroupId, result.groupId);
});

test("checkIn tidak buat reg baru bila sudah ada + checkedIn -> alreadyCheckedIn, tidak error", async () => {
  const { db, registrations, persons } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  registrations.push({ id: "reg-1", reunionId: "r-1", personId: "p-1", checkedInAt: new Date(), checkInSource: "QR_SELF", checkInGroupId: "g-1", status: "CONFIRMED", attendance: "ATTENDING", guestCount: 1 });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, { reunionId: "r-1", branchId: "b-1", rows: [{ personId: "p-1" }], source: "QR_SELF" as const, actorUserId: "u-admin" });

  assert.deepEqual(result.checkedIn, []);
  assert.deepEqual(result.alreadyCheckedIn, ["p-1"]);
});

test("checkIn membuat reg baru (CONFIRMED, ATTENDING) untuk anggota belum pernah daftar reuni", async () => {
  const { db, persons, registrations } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, { reunionId: "r-1", branchId: "b-1", rows: [{ personId: "p-1" }], source: "ADMIN" as const, actorUserId: "u-admin" });

  assert.deepEqual(result.checkedIn, ["p-1"]);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].status, "CONFIRMED");
  assert.equal(registrations[0].attendance, "ATTENDING");
  assert.equal(registrations[0].guestCount, 1);
  assert.equal(registrations[0].checkInSource, "ADMIN");
});

test("checkIn walk-in: tidak bikin User, membuat Person, set branchId", async () => {
  const { db, persons, captured } = fakeDb();
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, {
    reunionId: "r-1",
    branchId: "b-1",
    rows: [{ fullName: "Walk In Guest", namaPanggilan: "Walkie", gender: "MALE" }],
    source: "ADMIN" as const,
    actorUserId: "u-admin",
  });

  assert.equal(result.created.length, 1);
  assert.equal(result.checkedIn.length, 1);
  assert.equal(persons.length, 1);
  assert.equal(persons[0].branchId, "b-1");
  assert.equal(persons[0].fullName, "Walk In Guest");
  const userCreates = captured.filter((c) => c.kind === "user.create");
  assert.equal(userCreates.length, 0, "walk-in tidak boleh create User");
});

test("checkIn nama identik dua kali - satu Person, satu checkedIn + satu alreadyCheckedIn", async () => {
  const { db, persons, registrations } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  registrations.push({ id: "reg-1", reunionId: "r-1", personId: "p-1", checkedInAt: null, checkInSource: null, checkInGroupId: null, status: "CONFIRMED", attendance: "ATTENDING", guestCount: 1 });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, {
    reunionId: "r-1",
    branchId: "b-1",
    rows: [{ personId: "p-1" }, { personId: "p-1" }],
    source: "ADMIN" as const,
    actorUserId: "u-admin",
  });

  assert.deepEqual(result.checkedIn, ["p-1"]);
  assert.deepEqual(result.alreadyCheckedIn, ["p-1"]);
});

test("checkIn dua walk-in berbeda -> 2 Person", async () => {
  const { db, persons } = fakeDb();
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, {
    reunionId: "r-1",
    branchId: "b-1",
    rows: [
      { fullName: "Tamu Satu", namaPanggilan: "Satu", gender: "MALE" },
      { fullName: "Tamu Dua", namaPanggilan: "Dua", gender: "FEMALE" },
    ],
    source: "ADMIN" as const,
    actorUserId: "u-admin",
  });

  assert.equal(result.created.length, 2);
  assert.equal(persons.length, 2);
});

test("checkIn > MAX_ROWS -> throw TOO_MANY_ROWS", async () => {
  const { db } = fakeDb();
  const rows: CheckInRowInput[] = Array.from({ length: MAX_ROWS_PER_GROUP + 1 }, (_, i) => ({
    personId: `p-${i}`,
  }));
  await assert.rejects(
    checkIn(db, { reunionId: "r-1", branchId: "b-1", rows, source: "ADMIN" as const, actorUserId: "u-admin" }),
    /TOO_MANY_ROWS/,
  );
});

test("checkIn P2002 race -> alreadyCheckedIn (bukan error)", async () => {
  const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
  const { db, persons } = fakeDb({
    customTxReunionRegCreate: async () => {
      throw p2002;
    },
  });
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, {
    reunionId: "r-1",
    branchId: "b-1",
    rows: [{ personId: "p-1" }],
    source: "ADMIN" as const,
    actorUserId: "u-admin",
  });

  assert.deepEqual(result.alreadyCheckedIn, ["p-1"]);
  assert.deepEqual(result.checkedIn, []);
});

test("approveWalkInAccount: buat akun dengan mustChangeCredentials=true", async () => {
  const { db, persons, captured } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });

  const result = await approveWalkInAccount(db, { personId: "p-1", actorUserId: "u-admin" });

  assert.notEqual(result, "ALREADY_HAS_ACCOUNT");
  const r = result as { username: string };
  assert.ok(typeof r.username === "string");
  const userCreate = captured.find((c) => c.kind === "user.create") as Record<string, unknown> | undefined;
  assert.ok(userCreate);
  const createArgs = userCreate.args as { data: Record<string, unknown> };
  assert.equal(createArgs.data.mustChangeCredentials, true);
});

test("approveWalkInAccount: ALREADY_HAS_ACCOUNT bila sudah ada user", async () => {
  const { db, persons, users } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  users.push({ id: "u-budi", personId: "p-1", username: "budi" });

  const result = await approveWalkInAccount(db, { personId: "p-1", actorUserId: "u-admin" });
  assert.equal(result, "ALREADY_HAS_ACCOUNT");
});

test("cancelCheckIn: hapus jejak tapi tetap simpan Person + reg", async () => {
  const { db, registrations, persons } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi Santoso", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  registrations.push({ id: "reg-1", reunionId: "r-1", personId: "p-1", checkedInAt: new Date(), checkInSource: "QR_SELF", checkInGroupId: "g-1", status: "CONFIRMED", attendance: "ATTENDING", guestCount: 1 });

  const result = await cancelCheckIn(db, { registrationId: "reg-1", actorUserId: "u-admin" });

  assert.equal(result, true);
  assert.equal(registrations[0].checkedInAt, null);
  assert.equal(registrations[0].checkInSource, null);
  assert.equal(registrations[0].checkInGroupId, null);
  assert.equal(persons.length, 1, "Person tetap ada");
});

test("cancelCheckIn: false bila registrationId tidak ada", async () => {
  const { db } = fakeDb();
  const result = await cancelCheckIn(db, { registrationId: "nonexistent", actorUserId: "u-admin" });
  assert.equal(result, false);
});

test("lookup menolak tanpa branchId", async () => {
  const { db } = fakeDb();
  await assert.rejects(
    lookupCandidates(db, { reunionId: "r-1", q: "Budi" }),
    /BRANCH_ID_REQUIRED/,
  );
});

test("lookup mengembalikan array kosong bila tidak ada hasil", async () => {
  const { db } = fakeDb();
  db.person.findMany = async () => [];
  const results = await lookupCandidates(db, { reunionId: "r-1", branchId: "b-1", q: "ZZZZ" });
  assert.deepEqual(results, []);
});

test("approveWalkInAccount throw PERSON_NOT_FOUND bila person tidak ada", async () => {
  const { db } = fakeDb();
  await assert.rejects(
    approveWalkInAccount(db, { personId: "p-nonexistent", actorUserId: "u-admin" }),
    /PERSON_NOT_FOUND/,
  );
});

test("checkIn walk-in reuse existing person by name same branch", async () => {
  const { db, persons, captured } = fakeDb();
  persons.push({ id: "p-1", fullName: "Walk In Guest", namaPanggilan: "Walkie", gender: "MALE", branchId: "b-1", deletedAt: null });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const result = await checkIn(db, {
    reunionId: "r-1",
    branchId: "b-1",
    rows: [{ fullName: "Walk In Guest", namaPanggilan: "Walkie", gender: "MALE" }],
    source: "ADMIN" as const,
    actorUserId: "u-admin",
  });

  const personCreates = captured.filter((c) => c.kind === "person.create");
  assert.equal(personCreates.length, 0, "pakai Person yang sudah ada");
  assert.equal(result.created.length, 0);
  assert.equal(result.checkedIn.length, 1);
});

test("checkIn groupId unik per panggilan", async () => {
  const { db, persons } = fakeDb();
  persons.push({ id: "p-1", fullName: "Budi", namaPanggilan: "Budi", gender: "MALE", branchId: "b-1", deletedAt: null });
  (db as unknown as { reunion: { findUnique: () => Promise<unknown> } }).reunion.findUnique = async () => ({ id: "r-1" });
  db.reunionRegistration.findMany = async () => [];

  const r1 = await checkIn(db, { reunionId: "r-1", branchId: "b-1", rows: [{ personId: "p-1" }], source: "ADMIN" as const, actorUserId: "u-admin" });
  const r2 = await checkIn(db, { reunionId: "r-1", branchId: "b-1", rows: [{ personId: "p-1" }], source: "ADMIN" as const, actorUserId: "u-admin" });
  assert.notEqual(r1.groupId, r2.groupId);
});