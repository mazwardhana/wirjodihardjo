import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonNodeCard, type PersonNodeData } from "./PersonNode";
import { calculateAge } from "@/lib/profile";
import type { PublicPerson } from "@/lib/data";

function person(overrides: Partial<PublicPerson> = {}): PublicPerson {
  return {
    id: "M",
    fullName: "Yossi Maharani",
    nickname: null,
    namaPanggilan: "Yossi",
    gender: "FEMALE",
    birthDate: new Date("1980-05-10T00:00:00.000Z"),
    deathDate: null,
    birthPlace: "Yogyakarta",
    isDeceased: false,
    bio: null,
    photoUrl: null,
    generationLevel: 1,
    isMarriedInto: false,
    branch: { id: "b1", name: "Cabang 1", slug: "cabang-1" },
    socialLinks: [],
    ...overrides,
  };
}

function data(overrides: Partial<PersonNodeData> = {}): PersonNodeData {
  return {
    person: person(),
    childCount: 3,
    hasHiddenChildren: false,
    collapsed: false,
    partnerStatus: "MARRIED",
    ...overrides,
  };
}

test("kartu menampilkan nama lengkap, info, dan umur", () => {
  const markup = renderToStaticMarkup(PersonNodeCard({ data: data() }));
  assert.ok(markup.includes("Yossi Maharani"), "nama lengkap tampil");
  assert.ok(markup.includes("Anak"), "label generasi tampil");
  assert.ok(markup.includes("1980"), "tahun lahir tampil");
  assert.ok(markup.includes("Cabang 1"), "nama cabang tampil");

  const age = calculateAge(person().birthDate);
  assert.ok(markup.includes(`usia ${age} tahun`), `umur tampil: ${markup}`);
});

test("kartu memakai lebar 260px dan nama tanpa truncate", () => {
  const markup = renderToStaticMarkup(PersonNodeCard({ data: data() }));
  assert.ok(markup.includes("w-[260px]"), "lebar kartu 260px");
  const nameMatch = markup.match(/<p[^>]*>Yossi Maharani<\/p>/);
  assert.ok(nameMatch, "paragraf nama ditemukan");
  assert.ok(!nameMatch![0].includes("truncate"), "nama tidak dipotong");
});

test("kartu menampilkan ikon sosial dengan tautan aman", () => {
  const markup = renderToStaticMarkup(
    PersonNodeCard({
      data: data({
        person: person({
          socialLinks: [
            {
              id: "l1",
              url: "https://instagram.com/yossi",
              username: "yossi",
              platform: { name: "Instagram", iconName: "instagram" },
            },
          ],
        }),
      }),
    }),
  );
  assert.ok(markup.includes('aria-label="Instagram"'), "aria-label platform");
  assert.ok(markup.includes('href="https://instagram.com/yossi"'), "tautan sosial");
  assert.ok(markup.includes('target="_blank"'), "buka tab baru");
  assert.ok(markup.includes('rel="noopener noreferrer"'), "rel aman");
});

test("kartu menampilkan wafat usia memakai deathDate sebagai acuan", () => {
  const dead = person({
    isDeceased: true,
    deathDate: new Date("2020-05-10T00:00:00.000Z"),
  });
  const age = calculateAge(
    new Date("1980-05-10T00:00:00.000Z"),
    new Date("2020-05-10T00:00:00.000Z"),
  );
  const markup = renderToStaticMarkup(
    PersonNodeCard({ data: data({ person: dead }) }),
  );
  assert.ok(markup.includes(`wafat usia ${age} tahun`), `umur wafat tampil: ${markup}`);
});

test("kartu tidak menampilkan usia yang terus bertambah untuk wafat tanpa deathDate", () => {
  const dead = person({ isDeceased: true, deathDate: null });
  const markup = renderToStaticMarkup(
    PersonNodeCard({ data: data({ person: dead }) }),
  );
  assert.ok(!/usia \d+ tahun/.test(markup), `usia hidup tidak boleh tampil: ${markup}`);
  assert.ok(markup.includes("Almarhum"), "penanda wafat tetap tampil");
});

test("kartu tidak merender tautan sosial dengan protokol berbahaya", () => {
  const markup = renderToStaticMarkup(
    PersonNodeCard({
      data: data({
        person: person({
          socialLinks: [
            {
              id: "l1",
              url: "javascript:alert(1)",
              username: null,
              platform: { name: "Jahat", iconName: "instagram" },
            },
          ],
        }),
      }),
    }),
  );
  assert.ok(!markup.includes("javascript:alert(1)"), "URL javascript tidak dirender");
  assert.ok(!markup.includes('href="javascript:'), "tidak ada href javascript");
});

test("kartu memakai titik fallback bila iconName tidak dikenal", () => {
  const markup = renderToStaticMarkup(
    PersonNodeCard({
      data: data({
        person: person({
          socialLinks: [
            {
              id: "l1",
              url: "https://contoh.id",
              username: null,
              platform: { name: "Situs", iconName: null },
            },
          ],
        }),
      }),
    }),
  );
  assert.ok(markup.includes('aria-label="Situs"'), "aria-label platform fallback");
  assert.ok(markup.includes("rounded-full"), "ikon fallback berupa titik");
});
