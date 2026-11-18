import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Fungsi diuji tanpa mengimpor modul yang menarik `@prisma/client`:
// tipe FamilyEventType hanya tipe, jadi kita pakai salinan logika via import.
import {
  monthKey,
  localDateKey,
  occurrenceForYear,
  buildMonthCells,
  occurrenceInWindow,
  nextOccurrenceOnOrAfter,
  FAMILY_EVENT_TYPE_LABEL,
} from "./calendar";

describe("lib/calendar", () => {
  it("monthKey menghasilkan tahun-bulan 0-based", () => {
    assert.equal(monthKey(new Date(2027, 2, 13)), "2027-2");
  });

  it("localDateKey memformat lokal tanpa geser zona", () => {
    assert.equal(localDateKey(new Date(2027, 2, 13)), "2027-03-13");
  });

  it("occurrenceForYear: non-berulang mengembalikan startsAt", () => {
    const d = new Date(2026, 4, 10);
    assert.equal(occurrenceForYear(d, false, 2030), d);
  });

  it("occurrenceForYear: berulang tahunan memetakan ke tahun target", () => {
    const d = new Date(1940, 4, 12); // 12 Mei 1940
    const occ = occurrenceForYear(d, true, 2027);
    assert.equal(occ.getFullYear(), 2027);
    assert.equal(occ.getMonth(), 4);
    assert.equal(occ.getDate(), 12);
  });

  it("occurrenceForYear: 29 Feb dilandasi ke 28 Feb pada tahun non-kabisat", () => {
    const d = new Date(2000, 1, 29);
    const occ = occurrenceForYear(d, true, 2027);
    assert.equal(occ.getMonth(), 1);
    assert.equal(occ.getDate(), 28);
  });

  it("buildMonthCells: grid Senin-awal dengan padding", () => {
    // Maret 2027: 1 Maret jatuh Senin → tanpa padding awal, 31 hari, 35 sel.
    const cells = buildMonthCells(2027, 2);
    assert.equal(cells.length, 35);
    assert.equal(cells[0].date?.getDate(), 1);
    assert.equal(cells.filter((c) => c.inMonth).length, 31);
  });

  it("buildMonthCells: Agustus 2026 (1 Agustus Sabtu) punya 5 sel kosong awal", () => {
    const cells = buildMonthCells(2026, 7);
    assert.equal(cells[0].date, null);
    // Grid Senin-awal: Sabtu berada di kolom ke-6 → 5 sel kosong (Sen–Jum).
    assert.equal(cells[5].date?.getDate(), 1);
  });

  it("occurrenceInWindow: event satu kali di luar window → null", () => {
    const d = new Date(2027, 2, 13);
    assert.equal(
      occurrenceInWindow(d, false, new Date(2027, 2, 1), new Date(2027, 2, 12)),
      null,
    );
  });

  it("occurrenceInWindow: milad berulang muncul tiap tahun di window", () => {
    const d = new Date(1940, 4, 12);
    const occ = occurrenceInWindow(
      d,
      true,
      new Date(2027, 4, 1),
      new Date(2027, 4, 30),
    );
    assert.ok(occ);
    assert.equal(occ.getDate(), 12);
  });

  it("nextOccurrenceOnOrAfter: non-berulang apa adanya", () => {
    const d = new Date(2027, 2, 13);
    assert.equal(nextOccurrenceOnOrAfter(d, false, new Date(2026, 0, 1)), d);
  });

  it("nextOccurrenceOnOrAfter: berulang mengembalikan tahun ini bila belum lewat", () => {
    const d = new Date(1940, 4, 12);
    const occ = nextOccurrenceOnOrAfter(d, true, new Date(2026, 0, 1));
    assert.equal(occ.getFullYear(), 2026);
    assert.equal(occ.getDate(), 12);
  });

  it("FAMILY_EVENT_TYPE_LABEL lengkap 5 tipe", () => {
    assert.equal(Object.keys(FAMILY_EVENT_TYPE_LABEL).length, 5);
    assert.equal(FAMILY_EVENT_TYPE_LABEL.MILAD, "Milad");
    assert.equal(FAMILY_EVENT_TYPE_LABEL.HAUL, "Haul");
    assert.equal(FAMILY_EVENT_TYPE_LABEL.HALAL_BIHALAL, "Halal Bihalal");
  });
});