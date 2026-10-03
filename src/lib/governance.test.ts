import assert from "node:assert/strict";
import test from "node:test";
import { getGovernanceData } from "./governance";

type Row = Record<string, unknown>;

type State = {
  structure: Row | null;
  branches: Row[];
  branchReps: Row[];
  expiredReps: Row[];
};

function fixture(): State {
  return {
    structure: null,
    branches: [
      { id: "b1", name: "Cabang Satu", branchNumber: 1 },
      { id: "b2", name: "Cabang Dua", branchNumber: 2 },
    ],
    branchReps: [],
    expiredReps: [],
  };
}

function fakeDb(state: State) {
  return {
    governanceStructure: { findFirst: async () => state.structure },
    branch: { findMany: async () => state.branches },
    branchRepresentative: {
      findMany: async (args: { where?: { endDate?: unknown } }) => {
        const end = args?.where?.endDate;
        if (end && typeof end === "object" && "lt" in end) return state.expiredReps;
        return state.branchReps;
      },
    },
  } as never;
}

test("tanpa struktur aktif, memakai kerangka placeholder dan cabang sebagai dewan perwakilan", async () => {
  const data = await getGovernanceData(new Date("2026-10-03"), fakeDb(fixture()));
  assert.equal(data.structure?.name, "Kepengurusan Keluarga Besar Wirjodihardjo");
  assert.equal(data.branches.length, 2);
  assert.equal(data.branches[0].slot1, null);
  assert.ok(
    data.levels.some((l) => l.positions.some((p) => p.name === "Dewan Pertimbangan")),
    "placeholder harus dipakai",
  );
});

test("dengan struktur aktif, memakai data jabatan dan penugasan nyata", async () => {
  const state = fixture();
  state.structure = {
    name: "Kepengurusan 2026",
    description: "Susunan resmi",
    positions: [
      {
        id: "pos-1",
        name: "Ketua",
        description: "Memimpin",
        level: 0,
        assignments: [
          {
            id: "a-1",
            person: {
              id: "p-1",
              fullName: "Budi",
              photoUrl: null,
              occupation: null,
              branch: null,
            },
          },
        ],
      },
    ],
  };
  const data = await getGovernanceData(new Date("2026-10-03"), fakeDb(state));
  assert.equal(data.structure?.name, "Kepengurusan 2026");
  assert.equal(data.levels.length, 1);
  assert.equal(data.levels[0].positions[0].name, "Ketua");
  assert.equal(data.levels[0].positions[0].assignments[0].person.fullName, "Budi");
});

test("perwakilan cabang aktif mengisi slot, yang berakhir jadi catatan", async () => {
  const state = fixture();
  state.structure = { name: "Kepengurusan", description: null, positions: [] };
  state.branchReps = [
    {
      id: "r-1",
      branchId: "b1",
      slot: 1,
      notes: null,
      person: { id: "p-1", fullName: "Siti", photoUrl: null, occupation: null, branch: null },
    },
  ];
  state.expiredReps = [{ branchId: "b1", slot: 2, notes: "menunggu pengganti" }];
  const data = await getGovernanceData(new Date("2026-10-03"), fakeDb(state));
  const b1 = data.branches.find((b) => b.id === "b1")!;
  assert.equal(b1.slot1?.person?.fullName, "Siti");
  assert.equal(b1.slot2?.person, null);
  assert.equal(b1.slot2?.notes, "menunggu pengganti");
});
