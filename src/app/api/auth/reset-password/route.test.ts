import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

type Row = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;
type Handlers = Partial<Record<"POST", Handler>>;

const ONE_HOUR_MS = 60 * 60 * 1000;

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  mustChangeCredentials: boolean;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
};

type ResetState = {
  users: UserRow[];
  updates: Row[];
  auditRows: Row[];
  auditCalls: Row[];
  // Token mentah yang "dikirim" ke pemegang akun. Dipakai tes untuk
  // membuktikan kolom database menyimpan hash, bukan token itu sendiri.
  sentTokens: string[];
};

function makeState(): ResetState {
  return {
    users: [
      {
        id: "u1",
        username: "andi",
        email: "andi@contoh.id",
        passwordHash: "$2a$12$hashlama",
        mustChangeCredentials: false,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    ],
    updates: [],
    auditRows: [],
    auditCalls: [],
    sentTokens: [],
  };
}

type PrismaMock = {
  user: {
    findFirst: (args: {
      where: { OR: Array<{ username?: string; email?: string }> };
    }) => Promise<UserRow | null>;
    findUnique: (args: {
      where: { passwordResetToken?: string; id?: string };
    }) => Promise<UserRow | null>;
    // Hasil sengaja longgar: mock hanya menyalin data yang diminta rute,
    // bukan membangun baris User yang lengkap.
    update: (args: { where: { id: string }; data: Row }) => Promise<Row>;
  };
  auditLog: { create: (args: { data: Row }) => Promise<Row> };
  // Rute memanggil `prisma.$transaction(async (tx) => ...)`; mock menjalankan
  // callback dengan objek prisma yang sama agar tulisan tetap terekam.
  $transaction: (fn: (tx: PrismaMock) => Promise<unknown>) => Promise<unknown>;
};

function makePrisma(state: ResetState): PrismaMock {
  const prisma: PrismaMock = {
    user: {
      // Pencarian forgot-password memakai OR username/email.
      findFirst: async (args: {
        where: { OR: Array<{ username?: string; email?: string }> };
      }) => {
        for (const clause of args.where.OR) {
          const found = state.users.find(
            (u) =>
              (clause.username !== undefined && u.username === clause.username) ||
              (clause.email !== undefined && u.email === clause.email),
          );
          if (found) return { ...found };
        }
        return null;
      },
      // Pencarian reset-password memakai hash token sebagai kunci unik.
      findUnique: async (args: { where: { passwordResetToken?: string; id?: string } }) => {
        const where = args.where;
        if (typeof where.passwordResetToken === "string") {
          return (
            state.users.find((u) => u.passwordResetToken === where.passwordResetToken) ?? null
          );
        }
        if (typeof where.id === "string") {
          return state.users.find((u) => u.id === where.id) ?? null;
        }
        return null;
      },
      update: async (args: { where: { id: string }; data: Row }) => {
        state.updates.push(args.data);
        const target = state.users.find((u) => u.id === args.where.id);
        if (target) Object.assign(target, args.data);
        return { ...target, ...args.data };
      },
    },
    auditLog: {
      create: async (args: { data: Row }) => {
        state.auditRows.push(args.data);
        return args.data;
      },
    },
    // Mock menjalankan callback dengan objek prisma yang sama, sehingga semua
    // tulisan di dalam transaksi tetap terekam di state.
    $transaction: async (fn) => fn(prisma),
  };
  return prisma;
}

// Memuat modul TS asli ke konteks VM terpisah dengan dependensi diganti mock.
function loadModule(filename: string, requireMap: (id: string) => unknown) {
  const abs = resolve(filename);
  const output = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  // `module` tidak bisa dipakai sebagai nama variabel (aturan ESLint Next),
  // jadi pembungkusnya dinamakan `holder`.
  const holder = { exports: {} as Record<string, unknown> };
  runInNewContext(
    output,
    {
      exports: holder.exports,
      module: holder,
      URL,
      Request,
      Response,
      console,
      process,
      setTimeout,
      clearTimeout,
      Buffer,
      require: requireMap,
    },
    { filename: abs },
  );
  return holder.exports;
}

/** next/server hanya dipakai untuk NextResponse.json, jadi cukup stub ringan. */
const nextServerStub = {
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(payload), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  },
};

function loadResetRoutes(state: ResetState, options: { rateLimited?: boolean } = {}) {
  const nodeRequire = createRequire(resolve("src/app/api/auth/reset-password/route.ts"));
  const prisma = makePrisma(state);
  const auditModule = {
    logAudit: async (params: Row) => {
      state.auditCalls.push(params);
    },
  };
  // Notifikasi admin adalah satu-satunya saluran token, jadi mock-nya sekaligus
  // merekam token mentah yang "dikirim" untuk pembuktian hash di bawah.
  const notificationsModule = {
    notifyAdminsOfPasswordReset: async (params: { username: string; token: string }) => {
      state.sentTokens.push(params.token);
    },
  };
  // `@/lib/password-reset` memakai alias `@/` yang tidak dikenal Node, jadi
  // modul itu dimuat lewat pemuat TS yang sama, dengan `crypto` asli.
  const passwordResetModule = loadModule("src/lib/password-reset.ts", nodeRequire);

  const requireMap = (id: string) => {
    if (id === "next/server") return nextServerStub;
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/audit") return auditModule;
    if (id === "@/lib/notifications") return notificationsModule;
    if (id === "@/lib/password-reset") return passwordResetModule;
    if (id === "@/lib/rate-limit") {
      return { consumeRateLimit: () => options.rateLimited !== true };
    }
    return nodeRequire(id);
  };

  return {
    forgot: loadModule("src/app/api/auth/forgot-password/route.ts", requireMap) as Handlers,
    reset: loadModule("src/app/api/auth/reset-password/route.ts", requireMap) as Handlers,
  };
}

function jsonRequest(path: string, body: unknown) {
  return new Request("http://localhost" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Hash token dihitung ulang di luar route supaya tes dapat menanam token
// langsung ke state tanpa mengetahui isi kolom yang sebenarnya.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Menanam token yang masih sah (masa berlaku satu jam dari sekarang). */
function validTokenIn(state: ResetState, rawToken: string) {
  state.users[0].passwordResetToken = hashToken(rawToken);
  state.users[0].passwordResetExpires = new Date(Date.now() + ONE_HOUR_MS);
}

describe("POST /api/auth/forgot-password", () => {
  test("membalas pesan netral ketika email tidak terdaftar, tanpa tulisan", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    const response = await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "orang-asing@contoh.id" }),
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; message: string };
    assert.equal(body.ok, true);
    assert.ok(body.message.length > 0, "pesan netral wajib ada");
    // Tidak ada baris yang disentuh karena akun tidak ada.
    assert.equal(state.updates.length, 0);
    assert.equal(state.auditCalls.length, 0);
  });

  test("membalas pesan identik ketika akun terdaftar", async () => {
    const terdaftar = makeState();
    const tidakTerdaftar = makeState();
    const withUser = loadResetRoutes(terdaftar);
    const withoutUser = loadResetRoutes(tidakTerdaftar);

    const ada = await withUser.forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );
    const tidakAda = await withoutUser.forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "orang-asing@contoh.id" }),
    );

    assert.equal(ada.status, 200);
    assert.equal(tidakAda.status, 200);
    // Perbedaan keberadaan akun tidak boleh terlihat oleh pemanggil.
    assert.equal(await ada.text(), await tidakAda.text());
  });

  test("mencari user berdasarkan username, bukan hanya email", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    const response = await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi" }),
    );

    assert.equal(response.status, 200);
    assert.equal(state.updates.length, 1);
    assert.ok(state.updates[0].passwordResetToken, "token harus tersimpan");
  });

  test("menyimpan hash token, bukan token mentah", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );

    assert.equal(state.updates.length, 1);
    const stored = state.updates[0].passwordResetToken as string;
    // Token mentah juga 64 karakter hex, jadi panjangnya bukan bukti. Buktinya:
    // kolom berisi SHA-256 dari token yang dikirim, bukan token itu sendiri.
    assert.match(stored, /^[0-9a-f]{64}$/);
    const raw = state.sentTokens[state.sentTokens.length - 1];
    assert.ok(raw, "token mentah harus terekam untuk verifikasi");
    assert.equal(stored, hashToken(raw));
    assert.notEqual(stored, raw, "kolom tidak boleh menyimpan token mentah");
  });

  test("masa berlaku token tepat satu jam ke depan", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    const sebelum = Date.now();
    await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );
    const sesudah = Date.now();

    const expiresAt = state.updates[0].passwordResetExpires as Date;
    assert.ok(
      expiresAt.getTime() - sebelum >= ONE_HOUR_MS && expiresAt.getTime() - sesudah <= ONE_HOUR_MS,
      "masa berlaku harus tepat satu jam dari saat permintaan",
    );
  });

  test("mencatat audit dengan aksi permintaan reset", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );

    assert.equal(state.auditCalls.length, 1);
    assert.equal(state.auditCalls[0].action, "PASSWORD_RESET_REQUESTED");
    assert.equal(state.auditCalls[0].entityType, "User");
    assert.equal(state.auditCalls[0].entityId, "u1");
  });

  test("menolak emailOrUsername kosong dengan 400", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    const response = await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "   " }),
    );

    assert.equal(response.status, 400);
    assert.equal(state.updates.length, 0);
  });

  test("membalas 429 ketika laju terlampaui", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state, { rateLimited: true });
    const response = await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );

    assert.equal(response.status, 429);
    assert.equal(state.updates.length, 0);
  });

  test("menyerahkan token mentah ke admin, bukan hash-nya", async () => {
    const state = makeState();
    const { forgot } = loadResetRoutes(state);
    await forgot.POST!(
      jsonRequest("/api/auth/forgot-password", { emailOrUsername: "andi@contoh.id" }),
    );

    assert.equal(state.sentTokens.length, 1);
    const raw = state.sentTokens[0];
    assert.match(raw, /^[0-9a-f]{64}$/, "token yang dikirim harus acak 256-bit");
    assert.notEqual(raw, state.updates[0].passwordResetToken);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("reset gagal ketika token tidak dikenal", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "token-yang-tidak-ada",
        newPassword: "password123",
        confirmPassword: "password123",
      }),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("Token"));
    assert.equal(state.updates.length, 0);
    assert.equal(state.auditRows.length, 0);
  });

  test("reset gagal ketika token kedaluwarsa", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    const raw = "token-kedaluwarsa";
    // Hash tetap dikenal database; yang kedaluwarsa adalah masa berlakunya.
    state.users[0].passwordResetToken = hashToken(raw);
    state.users[0].passwordResetExpires = new Date(Date.now() - ONE_HOUR_MS);

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: raw,
        newPassword: "password123",
        confirmPassword: "password123",
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(state.updates.length, 0);
    assert.equal(state.auditRows.length, 0);
  });

  test("reset gagal ketika token mentah tidak cocok dengan hash yang tersimpan", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    validTokenIn(state, "token-asli");

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "token-palsu",
        newPassword: "password123",
        confirmPassword: "password123",
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(state.updates.length, 0);
  });

  test("reset berhasil mengubah password dan membersihkan token", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    const raw = "token-sah";
    validTokenIn(state, raw);

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: raw,
        newPassword: "password-baru-123",
        confirmPassword: "password-baru-123",
      }),
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);

    assert.equal(state.updates.length, 1);
    const data = state.updates[0];
    assert.ok(
      typeof data.passwordHash === "string" && (data.passwordHash as string).startsWith("$2"),
      "password baru harus tersimpan ter-hash bcrypt, bukan plaintext",
    );
    assert.notEqual(data.passwordHash, "password-baru-123");
    assert.equal(data.mustChangeCredentials, false);
    assert.equal(data.passwordResetToken, null);
    assert.equal(data.passwordResetExpires, null);

    assert.equal(state.auditRows.length, 1);
    assert.equal(state.auditRows[0].action, "PASSWORD_RESET_COMPLETED");
    assert.equal(state.auditRows[0].entityId, "u1");
  });

  test("reset menolak konfirmasi yang tidak cocok", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    validTokenIn(state, "token-sah");

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "token-sah",
        newPassword: "password123",
        confirmPassword: "lain-sekali",
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(state.updates.length, 0);
  });

  test("reset menolak password lebih pendek dari batas minimum", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    validTokenIn(state, "token-sah");

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "token-sah",
        newPassword: "pendek",
        confirmPassword: "pendek",
      }),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("8"), "pesan harus menyebut batas 8 karakter");
    assert.equal(state.updates.length, 0);
  });

  test("reset menolak token kosong", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "",
        newPassword: "password123",
        confirmPassword: "password123",
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(state.updates.length, 0);
  });

  test("reset membalas 429 ketika laju terlampaui", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state, { rateLimited: true });
    validTokenIn(state, "token-sah");

    const response = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: "token-sah",
        newPassword: "password123",
        confirmPassword: "password123",
      }),
    );

    assert.equal(response.status, 429);
    assert.equal(state.updates.length, 0);
  });

  test("token sekali pakai: setelah reset, token yang sama tidak berlaku lagi", async () => {
    const state = makeState();
    const { reset } = loadResetRoutes(state);
    const raw = "token-sekali-pakai";
    validTokenIn(state, raw);

    const first = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: raw,
        newPassword: "password-baru-123",
        confirmPassword: "password-baru-123",
      }),
    );
    assert.equal(first.status, 200);

    const second = await reset.POST!(
      jsonRequest("/api/auth/reset-password", {
        token: raw,
        newPassword: "password-lain-456",
        confirmPassword: "password-lain-456",
      }),
    );
    assert.equal(second.status, 400);
    // Hanya satu tulisan: percobaan kedua tidak mengubah password lagi.
    assert.equal(state.updates.length, 1);
  });
});
