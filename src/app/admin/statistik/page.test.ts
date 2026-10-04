import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type CredentialRow = {
  id: string;
  username: string;
  fullName: string;
  branchName: string | null;
  isVerified: boolean;
  createdAt: Date;
};

type Bundle = {
  family: {
    total: number;
    living: number;
    deceased: number;
    male: number;
    female: number;
    unassigned: number;
    livingPercent: number;
  };
  branches: Array<{
    id: string;
    name: string;
    slug: string;
    branchNumber: number;
    total: number;
    living: number;
    deceased: number;
  }>;
  reunion: {
    title: string | null;
    locationName: string | null;
    startAt: Date | null;
    confirmedPeople: number;
    waitlistPeople: number;
    cancelledPeople: number;
    attendeeCount: number;
    registrationOpen: boolean;
  };
  registration: {
    batchCount: number;
    rowsSubmitted: number;
    accountsMade: number;
    attendeesFromForm: number;
    lastSubmittedAt: Date | null;
  };
};

type State = {
  session: { user: { id: string } } | null;
  role: string | null;
  bundle: Bundle;
  credentials: CredentialRow[];
};

function fixture(): State {
  return {
    session: { user: { id: "u1" } },
    role: "SUPER_ADMIN",
    bundle: {
      family: {
        total: 1284,
        living: 918,
        deceased: 366,
        male: 640,
        female: 644,
        unassigned: 12,
        livingPercent: 71,
      },
      branches: [
        {
          id: "b1",
          name: "Keluarga Soedjinah",
          slug: "keluarga-soedjinah",
          branchNumber: 1,
          total: 512,
          living: 360,
          deceased: 152,
        },
        {
          id: "b2",
          name: "Keluarga Wiro Sentono",
          slug: "keluarga-wiro-sentono",
          branchNumber: 2,
          total: 388,
          living: 300,
          deceased: 88,
        },
      ],
      reunion: {
        title: "Reuni Wirjodihardjo 2.0 - Blitar, 2027",
        locationName: "Blitar",
        startAt: null,
        confirmedPeople: 214,
        waitlistPeople: 36,
        cancelledPeople: 9,
        attendeeCount: 250,
        registrationOpen: true,
      },
      registration: {
        batchCount: 7,
        rowsSubmitted: 62,
        accountsMade: 58,
        attendeesFromForm: 41,
        lastSubmittedAt: new Date("2026-10-03T09:30:00Z"),
      },
    },
    credentials: [
      {
        id: "c1",
        username: "budi.santoso",
        fullName: "Budi Santoso",
        branchName: "Keluarga Soedjinah",
        isVerified: true,
        createdAt: new Date("2026-10-03T09:30:00Z"),
      },
      {
        id: "c2",
        username: "siti.aminah",
        fullName: "Siti Aminah",
        branchName: null,
        isVerified: false,
        createdAt: new Date("2026-10-02T14:05:00Z"),
      },
    ],
  };
}

function loadPage(state: State) {
  const filename = resolve("src/app/admin/statistik/page.tsx");
  const nativeRequire = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      module: { exports },
      require: (id: string) => {
        if (id === "@/lib/auth") return { auth: async () => state.session };
        if (id === "@/lib/prisma") {
          return {
            prisma: {
              user: {
                findUnique: async () =>
                  state.role ? { role: state.role } : null,
              },
            },
          };
        }
        if (id === "@/lib/statistik") {
          return {
            getStatistics: async () => state.bundle,
            getRegistrationCredentials: async (
              _db: unknown,
              options: { take?: number } = {},
            ) => state.credentials.slice(0, options.take ?? 200),
            // Helper penyempitan tipe: fungsi identitas di runtime.
            asStatisticsDb: (client: unknown) => client,
          };
        }
        if (id === "next/navigation") {
          return {
            redirect: (path: string) => {
              throw new Error(`REDIRECT:${path}`);
            },
          };
        }
        if (id === "next/link") {
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                { href: props.href, className: props.className },
                props.children as React.ReactNode,
              ),
          };
        }
        if (id === "@/components/ui/States") {
          return {
            EmptyState: (props: { title: string; description: string }) =>
              React.createElement(
                "div",
                { "data-empty": "true" },
                React.createElement("h2", null, props.title),
                React.createElement("p", null, props.description),
              ),
          };
        }
        if (id === "@/components/admin/FilterBar") {
          return {
            FilterBar: (props: {
              config: { search?: { placeholder: string; param: string } };
            }) =>
              React.createElement("input", {
                type: "search",
                "aria-label": props.config.search?.placeholder,
              }),
          };
        }
        if (id.startsWith("@/")) return nativeRequire(resolve("src", id.slice(2)));
        return nativeRequire(id);
      },
    },
    { filename },
  );

  return exports.default as (props: {
    searchParams: Promise<{ q?: string }>;
  }) => Promise<React.ReactElement>;
}

async function render(state: State, q?: string) {
  const Page = loadPage(state);
  const element = await Page({ searchParams: Promise.resolve(q ? { q } : {}) });
  return renderToStaticMarkup(element);
}

describe("/admin/statistik", () => {
  test("agregat keluarga, cabang, dan registrasi dirender", async () => {
    const html = await render(fixture());

    // Ringkasan keluarga
    assert.ok(html.includes("1.284"), "total anggota diformat id-ID");
    assert.ok(html.includes("918"), "jumlah hidup tampil");
    assert.ok(html.includes("366"), "jumlah wafat tampil");
    assert.ok(html.includes("71%"), "persentase hidup tampil");

    // Sebaran per keluarga besar
    assert.ok(html.includes("Keluarga Soedjinah"), "nama cabang tampil");
    assert.ok(html.includes("Keluarga Wiro Sentono"), "cabang kedua tampil");
    assert.ok(html.includes("900"), "total per cabang dijumlahkan di tfoot");

    // Hasil form registrasi
    assert.ok(html.includes("58"), "jumlah akun dibuat dari batch tampil");
    assert.ok(html.includes("7"), "jumlah batch terkirim tampil");
  });

  test("tabel memakai caption, th scope col, dan th scope row", async () => {
    const html = await render(fixture());
    assert.ok(html.includes("<caption"), "tabel punya caption");
    assert.ok(html.includes('scope="col"'), "header kolom punya scope col");
    assert.ok(html.includes('scope="row"'), "baris punya scope row");
  });

  test("laporan kredensial menampilkan nama pengguna untuk SUPER_ADMIN", async () => {
    const html = await render(fixture());
    assert.ok(html.includes("budi.santoso"), "nama pengguna Budi tampil");
    assert.ok(html.includes("Budi Santoso"), "nama lengkap Budi tampil");
    assert.ok(html.includes("Keluarga Soedjinah"), "keluarga besar Budi tampil");
    assert.ok(html.includes("siti.aminah"), "nama pengguna Siti tampil");
    assert.ok(html.includes("Belum ditugaskan"), "cabang kosong ditulis jujur");
    assert.ok(html.includes("Terverifikasi"), "status verifikasi tampil");
  });

  test("password awal bersama ditampilkan dengan aturan wajib diganti", async () => {
    const html = await render(fixture());
    assert.ok(html.includes("12345678"), "password awal bersama tampil");
    assert.ok(
      html.includes("password awal bersama, wajib diganti saat login pertama"),
      "kalimat wajib mengganti password ikut tampil",
    );
    assert.ok(
      html.includes("Minta anggota mengganti password"),
      "peringatan ganti password setelah login pertama ikut tampil",
    );
    assert.ok(
      html.includes("hanya terbuka untuk pengurus inti"),
      "catatan admin-only ikut tampil",
    );
  });

  test("reuni tanpa tanggal menampilkan tanggal menyusul, bukan tanda hubung", async () => {
    const html = await render(fixture());
    assert.ok(html.includes("Tanggal &amp; waktu menyusul"));
    assert.ok(html.includes("250"), "total peserta reuni tampil");
    assert.ok(html.includes("214"), "jumlah terkonfirmasi tampil");
    assert.ok(html.includes("Pendaftaran dibuka"), "status pendaftaran tampil");
  });

  test("reuni yang sudah punya tanggal memakai format tanggal", async () => {
    const state = fixture();
    state.bundle.reunion.startAt = new Date("2027-04-11T08:00:00Z");
    const html = await render(state);
    assert.ok(html.includes("2027"), "tahun reuni tampil");
    assert.ok(!html.includes("menusul"), "tidak ada teks menusul setelah tanggal ada");
  });

  test("tanpa akun hasil registrasi tampil keadaan kosong yang jujur", async () => {
    const state = fixture();
    state.credentials = [];
    const html = await render(state);
    assert.ok(html.includes("Belum ada akun hasil registrasi"));
    assert.ok(
      !html.includes("akun menunggu password diganti"),
      "baris hitungan tidak dicetak saat daftar kosong",
    );
    assert.ok(!html.includes("budi.santoso"), "tidak ada baris akun karangan");
  });

  test("pencarian yang tidak cocok memberi keadaan kosong, bukan tabel kosong", async () => {
    const html = await render(fixture(), "tidak-ada-nama-ini");
    assert.ok(html.includes("Tidak ada akun yang cocok"));
    assert.ok(!html.includes("budi.santoso"), "baris yang tidak cocok tidak dirender");
  });

  test("pencarian menyaring daftar akun di sisi server", async () => {
    const html = await render(fixture(), "siti");
    assert.ok(html.includes("siti.aminah"), "baris yang cocok tetap tampil");
    assert.ok(!html.includes("budi.santoso"), "baris lain tersaring");
    assert.ok(html.includes("1 dari 2 akun cocok"), "ringkasan hasil filter tampil");
  });

  test("tanpa keluarga besar tampil keadaan kosong", async () => {
    const state = fixture();
    state.bundle.branches = [];
    const html = await render(state);
    assert.ok(html.includes("Belum ada keluarga besar"));
  });

  test("tanpa acara reuni tampil keadaan kosong", async () => {
    const state = fixture();
    state.bundle.reunion = {
      ...state.bundle.reunion,
      title: null,
      locationName: null,
      startAt: null,
      attendeeCount: 0,
    };
    const html = await render(state);
    assert.ok(html.includes("Belum ada acara reuni"));
    assert.ok(!html.includes("Tanggal &amp; waktu menyusul"));
  });

  test("BRANCH_ADMIN dialihkan keluar halaman", async () => {
    const state = fixture();
    state.role = "BRANCH_ADMIN";
    await assert.rejects(
      loadPage(state)({ searchParams: Promise.resolve({}) }),
      /REDIRECT:\/dashboard/,
    );
  });

  test("tanpa sesi dialihkan ke login", async () => {
    const state = fixture();
    state.session = null;
    await assert.rejects(
      loadPage(state)({ searchParams: Promise.resolve({}) }),
      /REDIRECT:\/login/,
    );
  });
});