import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { test } from "node:test";

export type Row = Record<string, unknown>;

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

interface State {
  session: { user: { id: string; role: Role } } | null;
  users: Record<string, { role: Role; branchAdminOf: { id: string } | null; isActive: boolean }>;
  persons: Record<string, { id: string; fullName: string; branchId: string | null; deletedAt: Date | null }>;
  branches: Record<string, { id: string; name: string }>;
  structures: Row[];
  positions: Row[];
  assignments: Row[];
  representatives: Row[];
  audits: Row[];
  writes: Row[];
}

function emptyState(): State {
  return {
    session: { user: { id: "u1", role: "SUPER_ADMIN" } },
    users: {
      u1: { role: "SUPER_ADMIN", branchAdminOf: null, isActive: true },
      u2: { role: "BRANCH_ADMIN", branchAdminOf: { id: "b1" }, isActive: true },
      u3: { role: "MEMBER", branchAdminOf: null, isActive: true },
    },
    persons: {
      p1: { id: "p1", fullName: "Person One", branchId: "b1", deletedAt: null },
      p2: { id: "p2", fullName: "Person Two", branchId: "b2", deletedAt: null },
    },
    branches: {
      b1: { id: "b1", name: "Cabang 1" },
      b2: { id: "b2", name: "Cabang 2" },
    },
    structures: [],
    positions: [],
    assignments: [],
    representatives: [],
    audits: [],
    writes: [],
  };
}

export function governanceFixture() {
  const state = emptyState();

  const userModel = {
    findUnique: async (args: { where: { id: string }; select: Row }) => {
      const user = state.users[args.where.id];
      if (!user) return null;
      return { role: user.role, branchAdminOf: user.branchAdminOf, isActive: user.isActive };
    },
  };

  const personModel = {
    findUnique: async (args: { where: { id: string } }) => {
      const person = state.persons[args.where.id];
      if (!person) return null;
      return { ...person };
    },
  };

  const branchModel = {
    findUnique: async (args: { where: { id: string } }) => {
      const branch = state.branches[args.where.id];
      return branch ? { ...branch } : null;
    },
  };

  const structureModel = {
    findMany: async () => state.structures,
    findUnique: async (args: { where: { id?: string; name?: string } }) => {
      const { id, name } = args.where;
      return state.structures.find((s) => (id ? s.id === id : s.name === name)) ?? null;
    },
    findFirst: async (args: { where: Row }) => {
      const where = args.where as {
        name?: string;
        id?: { not: string };
        isActive?: boolean;
      };
      return (
        state.structures.find((s) => {
          if (where.name !== undefined && s.name !== where.name) return false;
          if (where.id?.not !== undefined && s.id === where.id.not) return false;
          if (where.isActive !== undefined && s.isActive !== where.isActive) return false;
          return true;
        }) ?? null
      );
    },
    create: async (args: { data: Row }) => {
      const row = { id: `struct-${state.structures.length + 1}`, ...args.data };
      state.structures.push(row);
      state.writes.push(args.data);
      return row;
    },
    update: async (args: { where: { id: string }; data: Row }) => {
      const row = state.structures.find((s) => s.id === args.where.id);
      Object.assign(row!, args.data);
      state.writes.push(args.data);
      return row;
    },
  };

  const positionModel = {
    findMany: async (args: { where: { structureId: string } }) =>
      state.positions.filter((p) => p.structureId === args.where.structureId),
    findUnique: async (args: { where: { id: string } }) =>
      state.positions.find((p) => p.id === args.where.id) ?? null,
    create: async (args: { data: Row }) => {
      const row = { id: `pos-${state.positions.length + 1}`, ...args.data, _count: { assignments: 0, childPositions: 0 } };
      state.positions.push(row);
      state.writes.push(args.data);
      return row;
    },
    update: async (args: { where: { id: string }; data: Row }) => {
      const row = state.positions.find((p) => p.id === args.where.id);
      Object.assign(row!, args.data);
      state.writes.push(args.data);
      return row;
    },
    delete: async (args: { where: { id: string } }) => {
      state.writes.push({ deleted: args.where.id });
      return { id: args.where.id };
    },
  };

  const assignmentModel = {
    findMany: async (args: { where: { positionId: string } }) =>
      state.assignments.filter((a) => a.positionId === args.where.positionId),
    findFirst: async (args: { where: { positionId: string; personId: string } }) =>
      state.assignments.find(
        (a) => a.positionId === args.where.positionId && a.personId === args.where.personId,
      ) ?? null,
    count: async (args: { where: { positionId: string; branchId?: string } }) =>
      state.assignments.filter(
        (a) =>
          a.positionId === args.where.positionId &&
          (args.where.branchId === undefined || a.branchId === args.where.branchId),
      ).length,
    findUnique: async (args: { where: { id: string } }) => {
      const row = state.assignments.find((a) => a.id === args.where.id);
      if (!row) return null;
      return { ...row, person: state.persons[row.personId as string], position: { name: "Ketua" } };
    },
    create: async (args: { data: Row }) => {
      const row = { id: `asg-${state.assignments.length + 1}`, ...args.data };
      state.assignments.push(row);
      state.writes.push(args.data);
      return {
        ...row,
        person: state.persons[args.data.personId as string],
        branch: state.branches[args.data.branchId as string] ?? null,
      };
    },
    delete: async (args: { where: { id: string } }) => {
      state.writes.push({ deleted: args.where.id });
      return { id: args.where.id };
    },
  };

  const representativeModel = {
    findMany: async (args: { where: { branchId: string } }) =>
      state.representatives.filter((r) => r.branchId === args.where.branchId),
    findUnique: async (args: { where: Row }) => {
      const where = args.where as { id?: string; branchId_slot?: { branchId: string; slot: number } };
      if (where.branchId_slot) {
        return (
          state.representatives.find(
            (r) => r.branchId === where.branchId_slot!.branchId && r.slot === where.branchId_slot!.slot,
          ) ?? null
        );
      }
      const row = state.representatives.find((r) => r.id === where.id);
      if (!row) return null;
      return {
        ...row,
        person: state.persons[row.personId as string],
        branch: state.branches[row.branchId as string],
      };
    },
    create: async (args: { data: Row }) => {
      const row = { id: `rep-${state.representatives.length + 1}`, ...args.data };
      state.representatives.push(row);
      state.writes.push(args.data);
      return {
        ...row,
        person: state.persons[args.data.personId as string],
        branch: state.branches[args.data.branchId as string],
      };
    },
    delete: async (args: { where: { id: string } }) => {
      state.writes.push({ deleted: args.where.id });
      return { id: args.where.id };
    },
  };

  const prisma = {
    user: userModel,
    person: personModel,
    branch: branchModel,
    governanceStructure: structureModel,
    governancePosition: positionModel,
    governanceAssignment: assignmentModel,
    branchRepresentative: representativeModel,
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  return { state, prisma };
}

type Handler = (request: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;

// Load real route source with only auth, persistence, audit and rbac replaced.
export function loadGovernanceRoute(path: string, f: ReturnType<typeof governanceFixture>) {
  const filename = resolve(path);
  const require = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, Handler> = {};
  const rbac = loadRbac(f);
  runInNewContext(output, {
    exports, URL, Request, Response, console,
    require: (id: string) =>
      id === "@/lib/auth"
        ? { auth: async () => f.state.session }
        : id === "@/lib/prisma"
          ? { prisma: f.prisma }
          : id === "@/lib/audit"
            ? { logAudit: async (params: Row) => { f.state.audits.push(params); } }
            : id === "@/lib/rbac"
              ? rbac
              : require(id),
  }, { filename });
  return exports;
}

// Load the real RBAC helper so route authorization uses production semantics.
function loadRbac(f: ReturnType<typeof governanceFixture>) {
  const filename = resolve("src/lib/rbac.ts");
  const require = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(output, {
    exports,
    require: (id: string) =>
      id === "@/lib/prisma" ? { prisma: f.prisma } : require(id),
  }, { filename });
  return exports;
}

export const request = (method: string, body?: unknown) =>
  new Request("http://localhost/api/admin/governance", {
    method,
    ...(body !== undefined && { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });

export const json = async (response: Response) => (await response.json()) as Row;

export function assertNoWrites(f: ReturnType<typeof governanceFixture>) {
  assert.equal(f.state.writes.length, 0);
}

export { test, assert };
