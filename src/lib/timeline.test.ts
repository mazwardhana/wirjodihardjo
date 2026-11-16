import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLifeTimeline,
  formatTimelineDate,
  type TimelineEvent,
} from "./timeline";

function personFixture(overrides: Partial<Parameters<typeof buildLifeTimeline>[0]["person"]> = {}) {
  return {
    id: "p1",
    birthDate: null as Date | null,
    birthPlace: null as string | null,
    deathDate: null as Date | null,
    deathPlace: null as string | null,
    isDeceased: false,
    ...overrides,
  };
}

function lifeEventFixture(overrides: Partial<Parameters<typeof buildLifeTimeline>[0]["lifeEvents"][number]> = {}) {
  return {
    id: "le1",
    kind: "CUSTOM",
    title: "Peristiwa",
    description: null as string | null,
    locationName: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
    date: null as Date | null,
    datePrecision: null as string | null,
    ...overrides,
  };
}

function educationFixture(overrides: Partial<Parameters<typeof buildLifeTimeline>[0]["education"][number]> = {}) {
  return {
    id: "e1",
    institution: "Universitas Indonesia",
    degree: null as string | null,
    fieldOfStudy: null as string | null,
    startYear: null as number | null,
    endYear: null as number | null,
    ...overrides,
  };
}

function build(overrides: {
  person?: Partial<Parameters<typeof buildLifeTimeline>[0]["person"]>;
  lifeEvents?: Parameters<typeof buildLifeTimeline>[0]["lifeEvents"];
  education?: Parameters<typeof buildLifeTimeline>[0]["education"];
}) {
  return buildLifeTimeline({
    person: personFixture(overrides.person),
    lifeEvents: overrides.lifeEvents ?? [],
    education: overrides.education ?? [],
  });
}

test("virtual LAHIR dan WAFAT dibuat dari birthDate dan deathDate", () => {
  const { events } = build({
    person: {
      birthDate: new Date(1962, 4, 12),
      birthPlace: "Yogyakarta",
      deathDate: new Date(2020, 0, 3),
      isDeceased: true,
    },
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].key, "birth");
  assert.equal(events[0].kind, "BIRTH");
  assert.equal(events[0].title, "Lahir");
  assert.equal(events[0].locationName, "Yogyakarta");
  assert.equal(events[0].datePrecision, "DAY");
  assert.equal(events[0].year, 1962);
  assert.equal(events[0].source, "person");
  assert.equal(events[1].key, "death");
  assert.equal(events[1].kind, "DEATH");
  assert.equal(events[1].title, "Wafat");
  assert.equal(events[1].datePrecision, "DAY");
});

test("hanya birthPlace tetap menghasilkan event LAHIR bertep presisi YEAR", () => {
  const { events } = build({ person: { birthPlace: "Solo" } });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, "birth");
  assert.equal(events[0].date, null);
  assert.equal(events[0].datePrecision, "YEAR");
  assert.equal(events[0].year, null);
  assert.equal(events[0].locationName, "Solo");
});

test("hanya deathPlace menghasilkan event WAFAT", () => {
  const { events } = build({ person: { deathPlace: "Semarang" } });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, "death");
  assert.equal(events[0].locationName, "Semarang");
  assert.equal(events[0].date, null);
});

test("isDeceased tanpa tanggal tetap menghasilkan event WAFAT", () => {
  const { events } = build({ person: { isDeceased: true } });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, "death");
  assert.equal(events[0].date, null);
  assert.equal(events[0].datePrecision, "YEAR");
});

test("person tanpa data lahir memakai life-event BIRTH apa adanya", () => {
  const { events } = build({
    lifeEvents: [lifeEventFixture({
      id: "le-birth",
      kind: "BIRTH",
      title: "Kelahiran",
      date: new Date(1950, 1, 1),
      datePrecision: "DAY",
    })],
  });
  const birth = events.filter((e) => e.kind === "BIRTH");
  assert.equal(birth.length, 1);
  assert.equal(birth[0].key, "event:le-birth");
  assert.equal(birth[0].source, "life-event");
  assert.equal(birth[0].title, "Kelahiran");
});

test("life-event BIRTH dan DEATH diabaikan bila event virtual sudah ada", () => {
  const { events } = build({
    person: { birthDate: new Date(1962, 4, 12), isDeceased: true },
    lifeEvents: [
      lifeEventFixture({ id: "le-b", kind: "BIRTH", title: "Duplikat lahir" }),
      lifeEventFixture({ id: "le-d", kind: "DEATH", title: "Duplikat wafat" }),
    ],
  });
  assert.deepEqual(events.map((e) => e.kind).sort(), ["BIRTH", "DEATH"]);
  assert.equal(events.length, 2);
  assert.equal(events[0].key, "birth");
  assert.equal(events[1].key, "death");
});

test("life-event CUSTOM ikut tampil dengan data lengkap", () => {
  const { events } = build({
    lifeEvents: [lifeEventFixture({
      id: "le-c",
      kind: "CUSTOM",
      title: "Haji",
      description: "Berangkat bersama keluarga",
      locationName: "Makkah",
      latitude: 21.4225,
      longitude: 39.8262,
      date: new Date(1995, 6, 20),
      datePrecision: "MONTH",
    })],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, "event:le-c");
  assert.equal(events[0].kind, "CUSTOM");
  assert.equal(events[0].datePrecision, "MONTH");
  assert.equal(events[0].description, "Berangkat bersama keluarga");
});

test("education dipetakan ke event EDUCATION bertep YEAR pada 1 Januari", () => {
  const { events } = build({
    education: [educationFixture({
      id: "edu-1",
      institution: "Universitas Gadjah Mada",
      degree: "S1",
      fieldOfStudy: "Kedokteran",
      startYear: 1980,
    })],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, "edu:edu-1");
  assert.equal(events[0].kind, "EDUCATION");
  assert.equal(events[0].title, "Universitas Gadjah Mada (S1)");
  assert.equal(events[0].description, "Kedokteran");
  assert.equal(events[0].datePrecision, "YEAR");
  assert.equal(events[0].year, 1980);
  assert.deepEqual([events[0].date?.getMonth(), events[0].date?.getDate()], [0, 1]);
});

test("education tanpa tahun tetap tampil tanpa tanggal", () => {
  const { events } = build({
    education: [educationFixture({ id: "edu-2", startYear: null })],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].date, null);
  assert.equal(events[0].year, null);
});

test("sort: event bertanggal ascending lebih dulu, lalu yang tanpa tanggal", () => {
  const { events } = build({
    person: { birthDate: new Date(1960, 0, 1) },
    lifeEvents: [
      lifeEventFixture({ id: "le-a", title: "B", date: new Date(1975, 0, 1) }),
      lifeEventFixture({ id: "le-b", title: "Z" }),
      lifeEventFixture({ id: "le-c", title: "A", date: new Date(1970, 0, 1) }),
    ],
    education: [educationFixture({ id: "edu-3", startYear: 1980, institution: "Kampus" })],
  });
  const dated = events.filter((e) => e.date !== null);
  const undated = events.filter((e) => e.date === null);
  assert.deepEqual(dated.map((e) => e.year), [1960, 1970, 1975, 1980]);
  assert.ok(undated.length >= 1);
  // Tanpa tanggal: urut kind lalu title
  const undatedSorted = [...undated].map((e) => [e.kind, e.title]);
  assert.deepEqual(undatedSorted, [...undatedSorted].sort(([k1, t1], [k2, t2]) => k1.localeCompare(k2) || t1.localeCompare(t2)));
});

test("points diambil dari event berkordinat dan dideduplikasi", () => {
  const { points } = build({
    lifeEvents: [
      lifeEventFixture({ id: "le-1", title: "A", locationName: "Makkah", latitude: 21.42251, longitude: 39.82621 }),
      lifeEventFixture({ id: "le-2", title: "B", latitude: 21.42252, longitude: 39.82622 }),
      lifeEventFixture({ id: "le-3", title: "C", latitude: 1, longitude: 2, locationName: "Lain" }),
    ],
  });
  assert.equal(points.length, 2);
  assert.equal(points[0].name, "Makkah");
  assert.equal(points[1].name, "Lain");
  assert.equal(points[0].latitude, 21.42251);
});

test("formatTimelineDate: DAY, MONTH, YEAR, dan null", () => {
  const d = new Date(1962, 4, 12);
  assert.equal(formatTimelineDate(d, "DAY"), "12 Mei 1962");
  assert.equal(formatTimelineDate(d, "MONTH"), "Mei 1962");
  assert.equal(formatTimelineDate(d, "YEAR"), "1962");
  assert.equal(formatTimelineDate(null, "DAY"), null);
});

test("field person undefined diperlakukan seperti null, bukan memicu event WAFAT palsu", () => {
  // Prisma select selalu mengembalikan null, tapi pemanggil boleh meneruskan
  // objek parsial; jangan sampai undefined dianggap ada data kematian.
  const { events } = buildLifeTimeline({
    person: { id: "p1", birthDate: null, isDeceased: false } as never,
    lifeEvents: [],
    education: [],
  });
  assert.equal(events.length, 0);
});

test("event tanpa data apa pun tetap punya bentuk lengkap", () => {
  const { events } = build({
    lifeEvents: [lifeEventFixture({ id: "le-x", title: "Catatan" })],
  });
  const e: TimelineEvent = events[0];
  assert.equal(e.key, "event:le-x");
  assert.equal(e.description, null);
  assert.equal(e.locationName, null);
  assert.equal(e.latitude, null);
  assert.equal(e.longitude, null);
  assert.equal(e.date, null);
});
