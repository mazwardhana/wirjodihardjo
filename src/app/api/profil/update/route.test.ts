import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fixture, loadRoute, request, type Row } from "../../../../../tests/helpers/profile-route";

describe("Profile Update API", () => {
  test("POST requires authentication", async () => {
    const f = fixture(); f.state.session = null;
    const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { occupation: "Engineer" }))).status, 401);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST persists occupation and status to the Person record", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { occupation: "Engineer", status: "Active" }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[0];
    assert.equal(personUpdate.occupation, "Engineer");
    assert.equal(personUpdate.status, "Active");
  });

  test("POST persists nama panggilan separately from nickname", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { nickname: "akun123", namaPanggilan: "Budi" }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[0];
    assert.equal(personUpdate.nickname, "akun123");
    assert.equal(personUpdate.namaPanggilan, "Budi");
  });

  test("POST rejects occupation over 200 chars", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { occupation: "a".repeat(201) }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects status over 500 chars", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { status: "a".repeat(501) }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST keeps legacy fields working and audits the change", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { fullName: "A", bio: "B", phone: "123" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes[0].fullName, "A");
    const audit = f.state.writes[f.state.writes.length - 1];
    assert.equal((audit.data as Row).action, "UPDATE_PROFILE");
    assert.equal((audit.data as Row).actorUserId, "u1");
  });

  test("POST persists identity, birth, death and location fields", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", {
      gender: "FEMALE",
      birthPlace: "Yogyakarta",
      birthDate: "1950-03-12",
      birthDatePrecision: "DAY",
      isDeceased: true,
      deathPlace: "Semarang",
      deathDate: "2020-01-05",
      province: "Jawa Tengah",
      postalCode: "50123",
    }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[0];
    assert.equal(personUpdate.gender, "FEMALE");
    assert.equal(personUpdate.birthPlace, "Yogyakarta");
    assert.equal(personUpdate.birthDatePrecision, "DAY");
    assert.equal(personUpdate.deathPlace, "Semarang");
    assert.equal(personUpdate.isDeceased, true);
    // Jalur route berjalan di realm VM terpisah; pakai pengecekan lintas-realm.
    assert.equal(Object.prototype.toString.call(personUpdate.birthDate), "[object Date]");
    assert.equal((personUpdate.birthDate as Date).getUTCFullYear(), 1950);
    assert.equal(Object.prototype.toString.call(personUpdate.deathDate), "[object Date]");
    const priv = f.state.writes[1] as { update: Row };
    assert.equal(priv.update.province, "Jawa Tengah");
    assert.equal(priv.update.postalCode, "50123");
  });

  test("POST clears dates and death place with empty strings", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { birthDate: "", deathDate: "", deathPlace: "" }));
    assert.equal(response.status, 200);
    const personUpdate = f.state.writes[0];
    assert.equal(personUpdate.birthDate, null);
    assert.equal(personUpdate.deathDate, null);
    assert.equal(personUpdate.deathPlace, null);
  });

  test("POST rejects invalid gender", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { gender: "ROBOT" }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST rejects an invalid birth date", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    assert.equal((await route.POST(request("POST", { birthDate: "bukan-tanggal" }))).status, 400);
    assert.equal(f.state.writes.length, 0);
  });

  test("POST refuses to edit another member profile", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { personId: "p2", fullName: "Bukan saya" }));
    assert.equal(response.status, 403);
    assert.equal(f.state.writes.length, 0);
    assert.equal((await response.json()).error, "Anda hanya dapat mengubah profil sendiri");
  });

  test("POST accepts the caller's own personId", async () => {
    const f = fixture(); const route = loadRoute("src/app/api/profil/update/route.ts", f);
    const response = await route.POST(request("POST", { personId: "p1", fullName: "Saya" }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes[0].fullName, "Saya");
  });
});
