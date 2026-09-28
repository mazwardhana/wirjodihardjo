import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const filename = resolve("src/lib/auth.ts");
const require = createRequire(filename);

type AuthConfig = {
  callbacks: {
    jwt(args: { token: Record<string, unknown>; user?: unknown }): Promise<Record<string, unknown>>;
    session(args: { session: Record<string, unknown>; token: Record<string, unknown> }): Record<string, unknown>;
  };
};

/**
 * Muat src/lib/auth.ts dengan NextAuth palsu supaya konfigurasi callback bisa
 * diuji langsung, tanpa server Next.js.
 */
function loadAuthConfig(storedFlag: boolean | null) {
  const lookups: string[] = [];
  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        lookups.push(args.where.id);
        if (storedFlag === null) return null;
        return { mustChangeCredentials: storedFlag };
      },
    },
  };
  const captured: AuthConfig[] = [];
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(
    output,
    {
      exports: {},
      require: (id: string) => {
        if (id === "next-auth") {
          return (cfg: AuthConfig) => {
            captured.push(cfg);
            return {
              handlers: {},
              auth: async () => null,
              signIn: async () => undefined,
              signOut: async () => undefined,
            };
          };
        }
        if (id === "next-auth/providers/credentials") return () => (opts: unknown) => opts;
        if (id === "@/lib/prisma") return { prisma };
        if (id === "@/lib/session-flags") return require(resolve("src/lib/session-flags.ts"));
        return require(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
      process,
      Buffer,
      console,
    },
    { filename },
  );
  return { authConfig: captured[0], lookups };
}

test("stale mustChangeCredentials=true diangkat dari database", async () => {
  const { authConfig, lookups } = loadAuthConfig(false);
  const token = await authConfig.callbacks.jwt({ token: { id: "u1", mustChangeCredentials: true } });
  assert.equal(token.mustChangeCredentials, false);
  assert.deepEqual(lookups, ["u1"]);
});

test("flag yang sudah false tidak menyentuh database", async () => {
  const { authConfig, lookups } = loadAuthConfig(true);
  const token = await authConfig.callbacks.jwt({ token: { id: "u1", mustChangeCredentials: false } });
  assert.equal(token.mustChangeCredentials, false);
  assert.deepEqual(lookups, []);
});

test("login baru menyalin flag dari user tanpa query tambahan", async () => {
  const { authConfig, lookups } = loadAuthConfig(false);
  const token = await authConfig.callbacks.jwt({
    token: {},
    user: { id: "u1", role: "MEMBER", mustChangeCredentials: true },
  });
  assert.equal(token.id, "u1");
  assert.equal(token.role, "MEMBER");
  assert.equal(token.mustChangeCredentials, true);
  assert.deepEqual(lookups, []);
});

test("session callback meneruskan flag hasil sinkronisasi ke guard server", async () => {
  const { authConfig } = loadAuthConfig(false);
  const token = await authConfig.callbacks.jwt({ token: { id: "u1", mustChangeCredentials: true } });
  const session = authConfig.callbacks.session({
    session: { user: { name: null, email: null, image: null }, expires: "" },
    token,
  });
  const user = session.user as { id: string; role: string; mustChangeCredentials: boolean };
  assert.equal(user.mustChangeCredentials, false);
  assert.equal(user.id, "u1");
});
