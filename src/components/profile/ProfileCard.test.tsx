import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileCard } from "./ProfileCard";
import { projectPublicProfile } from "@/lib/profile";

const person = {
  id: "fixture", fullName: "Profile fixture", nickname: null, namaPanggilan: null, gender: "FEMALE" as const,
  birthDate: null, city: null, occupation: null, status: null, bio: null, photoUrl: null,
  generationLevel: null, isDeceased: false, branch: null, private: null,
};
test("public markup displays gender and honest missing fields without contacts", () => {
  const html = renderToStaticMarkup(<ProfileCard profile={projectPublicProfile(person)} />);
  assert.match(html, /Perempuan/);
  assert.match(html, /Belum ada data pendidikan/);
  assert.match(html, /Belum ada tautan publik/);
  assert.match(html, /Belum diisi/);
  assert.doesNotMatch(html, /wa.me|mailto:|tel:/);
});

test("member contact markup contains normalized WhatsApp and readable contact fields", () => {
  const html = renderToStaticMarkup(<ProfileCard profile={projectPublicProfile(person)} contacts={{ phone: "081234567890", whatsapp: "081234567890", email: "test@example.test", addressLine: "Test address" }} />);
  assert.match(html, /https:\/\/wa.me\/6281234567890/);
  assert.match(html, /Test address/);
});
