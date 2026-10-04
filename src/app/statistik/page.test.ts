import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const filename = resolve("src/app/statistik/page.tsx");
const nativeRequire = createRequire(filename);

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
    slug: string;
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

function loadPage(bundle: Bundle) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports: Record<string, unknown> = {};
  runInNewContext(
    output,
    {
      exports,
      require: (id: string) => {
        if (id === "@/lib/prisma") return { prisma: { __bundle: bundle } };
        if (id === "@/lib/statistik")
          return {
            getStatistics: async () => bundle,
            // Helper penyempitan tipe: di runtime hanya menerima lalu mengembalikan
            // objek yang sama, jadi stub ini cukup jadi fungsi identitas.
            asStatisticsDb: (client: unknown) => client,
          };
        if (id === "next/link")
          return {
            __esModule: true,
            default: (props: Record<string, unknown>) =>
              React.createElement(
                "a",
                { href: props.href, className: props.className },
                props.children as React.ReactNode,
              ),
          };
        if (id === "@/components/ui/EmptyState")
          return {
            EmptyState: (props: { title: string; description: string }) =>
              React.createElement("div", null, `${props.title} ${props.description}`),
          };
        // Reveal memakai hook browser; di render statis cukup children-nya.
        if (id === "@/components/ui/Reveal")
          return {
            Reveal: (props: { children: React.ReactNode }) =>
              React.createElement("div", null, props.children),
          };
        return nativeRequire(id.startsWith("@/") ? resolve("src", id.slice(2)) : id);
      },
    },
    { filename },
  );

  return exports.default as () => Promise<React.ReactElement>;
}

function branch(overrides: Partial<Bundle["branches"][number]> = {}) {
  return {
    id: "branch-1",
    name: "Keluarga Besar Rewa",
    slug: "keluarga-besar-rewa",
    branchNumber: 1,
    total: 40,
    living: 28,
    deceased: 12,
    ...overrides,
  };
}

function bundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    family: {
      total: 412,
      living: 318,
      deceased: 94,
      male: 208,
      female: 189,
      unassigned: 15,
      livingPercent: 77,
    },
    branches: [branch()],
    reunion: {
      title: "Reuni Wirjodihardjo 2.0 Blitar 2027",
      slug: "reuni-wirjodihardjo-2-0-blitar-2027",
      locationName: "Blitar, Jawa Timur",
      startAt: null,
      confirmedPeople: 62,
      waitlistPeople: 5,
      cancelledPeople: 3,
      attendeeCount: 67,
      registrationOpen: true,
    },
    registration: {
      batchCount: 6,
      rowsSubmitted: 214,
      accountsMade: 190,
      attendeesFromForm: 188,
      lastSubmittedAt: new Date("2026-09-20T08:30:00"),
    },
    ...overrides,
  };
}

test("angka utama dibaca dari data yang disuntik ke halaman", async () => {
  const Page = loadPage(bundle());
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("412"), "total anggota tampil");
  assert.ok(html.includes("318"), "jumlah yang masih hidup tampil");
  assert.ok(html.includes("94"), "jumlah yang sudah wafat tampil");
  assert.ok(html.includes("77%"), "persentase hidup tampil");
  assert.ok(
    html.includes(
      "Dari 412 anggota tercatat, 318 masih hidup (77 persen) dan 94 sudah wafat (23 persen).",
    ),
    "batang proporsi punya teks alternatif untuk pembaca layar",
  );
  assert.ok(html.includes("208"), "pisahan laki-laki tampil");
  assert.ok(html.includes("189"), "pisahan perempuan tampil");
});

test("jadwal reuni yang belum ditetapkan ditulis menyusul, bukan tanda hubung", async () => {
  const Page = loadPage(bundle());
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("menyusul"), "kata menyusul tampil");
  assert.ok(!html.includes("NaN"), "tidak ada angka rusak dari tanggal kosong");
  assert.ok(!html.includes("Invalid Date"), "tidak ada tanggal rusak");
  assert.ok(html.includes("Reuni Wirjodihardjo 2.0 Blitar 2027"), "judul reuni tampil");
  assert.ok(html.includes("Blitar, Jawa Timur"), "lokasi reuni tampil");
  assert.ok(html.includes("67"), "jumlah peserta reuni tampil");
  assert.ok(
    html.includes("/reuni/reuni-wirjodihardjo-2-0-blitar-2027"),
    "tautan daftar muncul saat pendaftaran dibuka",
  );
});

test("jadwal reuni yang sudah ada tanggal ditampilkan apa adanya", async () => {
  const Page = loadPage(
    bundle({
      reunion: {
        ...bundle().reunion,
        startAt: new Date("2027-08-08T08:00:00"),
      },
    }),
  );
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("2027"), "tahun jadwal tampil");
  assert.ok(!html.includes("menyusul"), "kata menyusul tidak muncul saat tanggal ada");
});

test("pendaftaran yang ditutup diberi penjelasan, tanpa tombol mati", async () => {
  const Page = loadPage(
    bundle({ reunion: { ...bundle().reunion, registrationOpen: false } }),
  );
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("belum dibuka"), "tertutup disebut apa adanya");
  assert.ok(
    !html.includes("/reuni/reuni-wirjodihardjo-2-0-blitar-2027"),
    "tidak ada tautan pendaftaran yang tidak bisa dipakai",
  );
});

test("keluarga cabang tanpa anggota tetap tampil di daftar", async () => {
  const Page = loadPage(
    bundle({
      branches: [
        branch({ id: "b1", name: "Keluarga Besar Ngadi", branchNumber: 2, total: 0, living: 0, deceased: 0 }),
        branch({ id: "b2", name: "Keluarga Besar Rewa", branchNumber: 1 }),
        branch({ id: "b3", name: "Keluarga Besar Sastro", branchNumber: 3, total: 12, living: 12, deceased: 0 }),
      ],
    }),
  );
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("Keluarga Besar Ngadi"), "cabang kosong tetap tampil");
  assert.ok(html.includes("belum ada anggota tercatat"), "keadaan kosong dijelaskan");
  assert.ok(html.includes("3 keluarga cabang"), "semua cabang dihitung");
  // Peringkat: Rewa (40) lebih dulu, lalu Sastro (12), lalu Ngadi (0).
  assert.ok(
    html.indexOf("Keluarga Besar Rewa") < html.indexOf("Keluarga Besar Sastro"),
    "daftar diurutkan dari yang paling banyak",
  );
  assert.ok(
    html.indexOf("Keluarga Besar Sastro") < html.indexOf("Keluarga Besar Ngadi"),
    "cabang kosong ada di urutan akhir",
  );
  assert.ok(html.includes("30%"), "porsi dihitung terhadap keluarga terbesar");
  assert.ok(
    html.includes('style="width:0%"'),
    "keluarga tanpa anggota batangnya kosong, bukan sisa kecil",
  );
});

test("anggota yang belum ditugaskan disebut secara terbuka", async () => {
  const Page = loadPage(bundle());
  const html = renderToStaticMarkup(await Page());

  assert.ok(
    html.includes("belum ditugaskan ke keluarga cabang mana pun"),
    "catatan anggota belum ditugaskan tampil",
  );
  assert.ok(html.includes("15 anggota lain"), "jumlahnya ikut disebut");
});

test("kontribusi form registrasi ditampilkan apa adanya, termasuk angka nol", async () => {
  const Page = loadPage(bundle());
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("214"), "baris terkirim tampil");
  assert.ok(html.includes("190"), "akun terbentuk tampil");
  assert.ok(html.includes("Kontribusi form registrasi"), "judul bagian tampil");

  const PageKosong = loadPage(
    bundle({
      registration: {
        batchCount: 0,
        rowsSubmitted: 0,
        accountsMade: 0,
        attendeesFromForm: 0,
        lastSubmittedAt: null,
      },
    }),
  );
  const htmlKosong = renderToStaticMarkup(await PageKosong());
  assert.ok(htmlKosong.includes("Belum ada formulir yang dikirim"), "keadaan kosong jujur");
});

test("arsip kosong menjelaskan penyebabnya, tidak menampilkan data contoh", async () => {
  const Page = loadPage(
    bundle({
      family: {
        total: 0,
        living: 0,
        deceased: 0,
        male: 0,
        female: 0,
        unassigned: 0,
        livingPercent: 0,
      },
      branches: [],
    }),
  );
  const html = renderToStaticMarkup(await Page());

  assert.ok(html.includes("Belum ada anggota tercatat"));
  assert.ok(html.includes("Belum ada keluarga cabang"));
  assert.ok(!html.includes("412"), "tidak ada angka karangan");
});

test("halaman publik hanya menampilkan agregat, tanpa data akun", async () => {
  const Page = loadPage(bundle());
  const html = renderToStaticMarkup(await Page());

  const dilarang = [
    "password",
    'type="password"',
    "username",
    "mustChangeCredentials",
    "createdBy",
    "ipAddress",
    "@gmail.com",
    'name="email"',
    'type="email"',
    "fullName",
  ];
  for (const kata of dilarang) {
    assert.ok(
      !html.toLowerCase().includes(kata.toLowerCase()),
      `halaman tidak boleh memuat "${kata}"`,
    );
  }
});
