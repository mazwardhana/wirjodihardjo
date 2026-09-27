import assert from "node:assert/strict";
import test from "node:test";
import {
  validateBranchAdminAssignment,
  clearBranchAdminOnDemotion,
  BranchAdminValidationError,
} from "./branch-admin-validation";

type Role = "SUPER_ADMIN" | "BRANCH_ADMIN" | "MEMBER";

interface UserRow {
  role: Role;
  isActive: boolean;
}

function makeUserDb(userRow: UserRow | null) {
  return {
    user: {
      findUnique: async () => userRow,
    },
  };
}

function makeBranchDb(calls: { where: any; data: any }[] = []) {
  return {
    branch: {
      updateMany: async (args: { where: any; data: any }) => {
        calls.push(args);
        return { count: 1 };
      },
    },
  };
}

// validateBranchAdminAssignment tests

test("validateBranchAdminAssignment rejects non-existent user", async () => {
  const db = makeUserDb(null);
  await assert.rejects(
    () => validateBranchAdminAssignment("user-123", db as never),
    (err: unknown) => err instanceof BranchAdminValidationError && err.message === "Pengguna tidak ditemukan"
  );
});

test("validateBranchAdminAssignment rejects MEMBER role", async () => {
  const db = makeUserDb({ role: "MEMBER", isActive: true });
  await assert.rejects(
    () => validateBranchAdminAssignment("user-123", db as never),
    (err: unknown) => 
      err instanceof BranchAdminValidationError && 
      err.message.includes("BRANCH_ADMIN")
  );
});

test("validateBranchAdminAssignment rejects SUPER_ADMIN role", async () => {
  const db = makeUserDb({ role: "SUPER_ADMIN", isActive: true });
  await assert.rejects(
    () => validateBranchAdminAssignment("user-123", db as never),
    (err: unknown) => 
      err instanceof BranchAdminValidationError && 
      err.message.includes("BRANCH_ADMIN")
  );
});

test("validateBranchAdminAssignment rejects inactive BRANCH_ADMIN", async () => {
  const db = makeUserDb({ role: "BRANCH_ADMIN", isActive: false });
  await assert.rejects(
    () => validateBranchAdminAssignment("user-123", db as never),
    (err: unknown) => 
      err instanceof BranchAdminValidationError && 
      err.message.includes("tidak aktif")
  );
});

test("validateBranchAdminAssignment allows active BRANCH_ADMIN", async () => {
  const db = makeUserDb({ role: "BRANCH_ADMIN", isActive: true });
  await assert.doesNotReject(() => validateBranchAdminAssignment("user-123", db as never));
});

// clearBranchAdminOnDemotion tests

test("clearBranchAdminOnDemotion clears assignment when demoting to MEMBER", async () => {
  const calls: any[] = [];
  const db = makeBranchDb(calls);
  
  await clearBranchAdminOnDemotion("user-123", "MEMBER", db as never);
  
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.adminId, "user-123");
  assert.equal(calls[0].data.adminId, null);
});

test("clearBranchAdminOnDemotion clears assignment when demoting to SUPER_ADMIN", async () => {
  const calls: any[] = [];
  const db = makeBranchDb(calls);
  
  await clearBranchAdminOnDemotion("user-123", "SUPER_ADMIN", db as never);
  
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.adminId, "user-123");
  assert.equal(calls[0].data.adminId, null);
});

test("clearBranchAdminOnDemotion does nothing when role stays BRANCH_ADMIN", async () => {
  const calls: any[] = [];
  const db = makeBranchDb(calls);
  
  await clearBranchAdminOnDemotion("user-123", "BRANCH_ADMIN", db as never);
  
  assert.equal(calls.length, 0);
});
