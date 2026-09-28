import assert from "node:assert/strict";
import test from "node:test";

import {
  PARENT_SEARCH_DEBOUNCE_MS,
  PARENT_SEARCH_LIMIT,
  PARENT_SEARCH_MIN_LENGTH,
  buildParentSearchUrl,
  createParentSearch,
  isSearchableQuery,
  type ParentSearchState,
} from "./parent-search";

type Anggota = { id: string; nama: string };

type PermintaanTertunda = {
  query: string;
  signal: AbortSignal;
  resolve: (hasil: Anggota[]) => void;
  reject: (galat: unknown) => void;
};

/** Scheduler manual supaya debounce bisa dikendalikan test. */
function manualScheduler() {
  const pending: Array<{ fn: () => void; cancelled: boolean }> = [];
  const delays: number[] = [];
  return {
    schedule: (fn: () => void, delayMs: number) => {
      delays.push(delayMs);
      const entry = { fn, cancelled: false };
      pending.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    delays,
    runAll() {
      for (const entry of pending.splice(0)) if (!entry.cancelled) entry.fn();
    },
  };
}

/** Pengganti fetch: setiap panggilan dicatat dan hasilnya diselesaikan manual oleh test. */
function fetchPalsu() {
  const calls: PermintaanTertunda[] = [];
  const fetchMembers = (query: string, signal: AbortSignal) =>
    new Promise<Anggota[]>((resolve, reject) => {
      calls.push({ query, signal, resolve, reject });
    });
  return { fetchMembers, calls };
}

function last<T>(items: T[]): T {
  assert.ok(items.length > 0, "daftar masih kosong");
  return items[items.length - 1];
}

/** Memberi waktu agar promise yang sudah diselesaikan sempat diproses. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

function buatSutradara() {
  const scheduler = manualScheduler();
  const { fetchMembers, calls } = fetchPalsu();
  const states: ParentSearchState<Anggota>[] = [];
  const controller = createParentSearch<Anggota>({
    fetchMembers,
    onChange: (state) => {
      states.push(state);
    },
    schedule: scheduler.schedule,
  });
  return { scheduler, calls, states, controller };
}

const kosong: ParentSearchState<Anggota> = { options: [], searching: false, error: null };

test("query kurang dari 2 karakter tidak memanggil fetchMembers dan mengosongkan hasil", async () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  // Fase dingin: belum pernah ada pencarian.
  controller.search(" a ");
  controller.search("   ");
  scheduler.runAll();
  assert.equal(calls.length, 0, "fetchMembers tidak boleh dipanggil");
  assert.deepEqual(last(states), kosong);

  // Fase setelah pencarian sukses: hasil lama harus dikosongkan.
  controller.search("budi");
  scheduler.runAll();
  calls[0].resolve([{ id: "1", nama: "Budi" }]);
  await settle();
  assert.equal(last(states).options.length, 1);

  controller.search("  x  ");
  scheduler.runAll();
  assert.equal(calls.length, 1, "fetchMembers tidak boleh dipanggil lagi");
  assert.deepEqual(last(states), kosong);
});

test("beberapa search sebelum debounce hanya memanggil fetchMembers sekali dengan query terakhir", () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  controller.search("bu");
  controller.search("bud");
  controller.search("  budi  ");

  assert.equal(last(states).searching, true, "keadaan mencari langsung diumumkan");
  scheduler.runAll();

  assert.equal(calls.length, 1, "hanya satu permintaan yang boleh terkirim");
  assert.equal(calls[0].query, "budi", "query terakhir yang dipakai");
  assert.ok(scheduler.delays.length > 0);
  assert.ok(
    scheduler.delays.every((delay) => delay === PARENT_SEARCH_DEBOUNCE_MS),
    "semua jadwal memakai debounce standar",
  );
});

test("respons basi diabaikan dan tidak menimpa hasil query terakhir", async () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  controller.search("budi");
  scheduler.runAll();
  controller.search("siti");
  scheduler.runAll();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].query, "budi");
  assert.equal(calls[1].query, "siti");

  // Query terakhir selesai lebih dulu.
  calls[1].resolve([{ id: "2", nama: "Siti" }]);
  await settle();
  assert.deepEqual(last(states), { options: [{ id: "2", nama: "Siti" }], searching: false, error: null });

  // Query lama baru selesai sesudahnya, hasilnya harus dibuang.
  const jumlahSebelum = states.length;
  calls[0].resolve([{ id: "1", nama: "Budi" }]);
  await settle();

  assert.equal(states.length, jumlahSebelum, "respons basi tidak boleh memanggil onChange");
  assert.deepEqual(last(states), { options: [{ id: "2", nama: "Siti" }], searching: false, error: null });
});

test("galat AbortError tidak mengisi error", async () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  controller.search("budi");
  scheduler.runAll();
  const jumlahSebelum = states.length;

  calls[0].reject(new DOMException("aborted", "AbortError"));
  await settle();

  assert.equal(states.length, jumlahSebelum, "AbortError tidak boleh memanggil onChange");
  assert.equal(last(states).error, null);
});

test("galat selain AbortError mengisi error dengan pesan dan mengosongkan hasil", async () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  controller.search("budi");
  scheduler.runAll();
  calls[0].reject(new Error("server bermasalah"));
  await settle();

  assert.deepEqual(last(states), { options: [], searching: false, error: "server bermasalah" });
});

test("search kosong membatalkan permintaan yang sedang jalan", () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  controller.search("budi");
  scheduler.runAll();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, false);

  controller.search("");

  assert.equal(calls[0].signal.aborted, true, "permintaan tertunda harus dibatalkan");
  scheduler.runAll();
  assert.equal(calls.length, 1, "query kosong tidak boleh memicu permintaan baru");
  assert.deepEqual(last(states), kosong);
});

test("cancel membatalkan timer dan permintaan tanpa memanggil onChange", () => {
  const { scheduler, calls, states, controller } = buatSutradara();

  // Batalkan sebelum debounce jalan.
  controller.search("budi");
  const jumlahSebelum = states.length;
  controller.cancel();
  scheduler.runAll();
  assert.equal(calls.length, 0, "timer yang dibatalkan tidak boleh dijalankan");
  assert.equal(states.length, jumlahSebelum, "cancel tidak boleh memanggil onChange");

  // Batalkan setelah permintaan berjalan.
  controller.search("siti");
  scheduler.runAll();
  const permintaan = calls[0];
  controller.cancel();
  assert.equal(permintaan.signal.aborted, true, "permintaan berjalan harus dibatalkan");
});

test("isSearchableQuery mengikuti panjang minimum setelah trim", () => {
  assert.equal(PARENT_SEARCH_MIN_LENGTH, 2);
  assert.equal(isSearchableQuery(""), false);
  assert.equal(isSearchableQuery("   "), false);
  assert.equal(isSearchableQuery(" a "), false);
  assert.equal(isSearchableQuery("ab"), true);
  assert.equal(isSearchableQuery("  ab  "), true);
});

test("buildParentSearchUrl menyusun URL dengan limit dan query ter-encode", () => {
  assert.equal(PARENT_SEARCH_LIMIT, 8);
  const url = buildParentSearchUrl("cabang-1", "budi santoso");
  assert.equal(
    url,
    `/api/admin/keluarga/members?branchId=cabang-1&q=${encodeURIComponent("budi santoso")}&limit=${PARENT_SEARCH_LIMIT}`,
  );

  const urlKhusus = buildParentSearchUrl("a&b", "x=y");
  assert.ok(urlKhusus.includes("branchId=a%26b"), "branchId ikut di-encode");
  assert.ok(urlKhusus.includes("q=x%3Dy"), "query ikut di-encode");
});
