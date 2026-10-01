import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateAge, projectPublicProfile, projectMemberProfile, normalizeWhatsApp } from "./profile";

const now = new Date("2026-09-27T00:00:00Z");
export const personFixture = {
  id: "test-person", fullName: "Test profile", nickname: null, namaPanggilan: null, gender: "MALE" as const,
  birthDate: new Date("1990-09-28T00:00:00Z"), city: "Test city", occupation: null,
  status: null, bio: null, photoUrl: null, generationLevel: 2, isDeceased: false, branch: null,
  education: [], socialLinks: [],
  private: { phone: "private-phone", whatsapp: "0812 3456 7890", addressLine: "private-address", email: "private@example.test", visibleToMembers: true },
};

test("age uses UTC birthdays, handles missing/invalid/future dates", () => {
  assert.equal(calculateAge(personFixture.birthDate, now), 35);
  assert.equal(calculateAge(new Date("1990-09-27"), now), 36);
  assert.equal(calculateAge(new Date("2000-02-29"), new Date("2025-02-28")), 24);
  assert.equal(calculateAge(null, now), null);
  assert.equal(calculateAge(new Date("invalid"), now), null);
  assert.equal(calculateAge(new Date("2027-01-01"), now), null);
});

test("public projection allowlists fields without nested private data or birth date", () => {
  const result = projectPublicProfile(personFixture, now);
  assert.equal(result.age, 35);
  assert.equal(result.city, "Test city");
  const serialized = JSON.stringify(result);
  for (const hidden of ["private", "phone", "whatsapp", "email", "addressLine", "birthDate", "visibleToMembers"]) {
    assert.ok(!serialized.includes(hidden), hidden);
  }
});

test("public social links require explicit visibility and safe web URLs", () => {
  const platform = { name: "Test platform" };
  const links = [
    { id: "public", url: "https://example.test/public", username: null, platform, isPublic: true },
    { id: "private", url: "https://example.test/private", username: null, platform, isPublic: false },
    { id: "unset", url: "https://example.test/unset", username: null, platform },
    { id: "unsafe", url: "javascript:alert(1)", username: null, platform, isPublic: true },
  ];
  assert.deepEqual(projectPublicProfile({ ...personFixture, socialLinks: links }).socialLinks.map(l => l.id), ["public"]);
});

test("family contact requires both MEMBER+ role and visibleToMembers consent", () => {
  for (const role of [undefined, "GUEST", "UNKNOWN"] as const) {
    assert.equal(projectMemberProfile(personFixture, role).phone, null);
  }
  for (const role of ["MEMBER", "BRANCH_ADMIN", "SUPER_ADMIN"] as const) {
    assert.equal(projectMemberProfile(personFixture, role).phone, "private-phone");
    assert.equal(projectMemberProfile({ ...personFixture, private: { ...personFixture.private, visibleToMembers: false } }, role).phone, null);
  }
  assert.equal(projectMemberProfile({ ...personFixture, private: null }, "MEMBER").phone, null);
});

test("WhatsApp normalizes local and international phone numbers without inventing a country code", () => {
  assert.equal(normalizeWhatsApp("0812 3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsApp("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsApp("+44 7700 900123"), "447700900123");
  assert.equal(normalizeWhatsApp("not a phone"), null);
  assert.equal(normalizeWhatsApp("123"), null);
});
