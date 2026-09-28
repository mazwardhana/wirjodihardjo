const MAX_USERNAME = 24;
const MAX_TOTAL = 30;
const MIN_USERNAME = 3;

/**
 * Bersihkan satu kandidat username: lowercase, ganti karakter di luar
 * `[a-z0-9_]` menjadi `_`, rapikan `_` berlebih, lalu potong 24 karakter.
 */
export function slugifyUsername(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, MAX_USERNAME);
}

function padUsername(value: string): string {
  let result = value;
  while (result.length < MIN_USERNAME) result += "_x";
  return result.slice(0, MAX_USERNAME);
}

/**
 * Turunkan base username dari nickname, dengan fallback ke nama lengkap bila
 * nickname terlalu pendek. Hasil selalu 3-24 karakter.
 */
export function deriveBaseUsername(nickname: string, fullName: string): string {
  let base = slugifyUsername(nickname);
  if (base.length < MIN_USERNAME) base = slugifyUsername(fullName);
  if (base.length < MIN_USERNAME) base = padUsername(base);
  return base;
}

/**
 * Turunkan username unik. `taken` berisi username yang sudah dipakai (di DB
 * maupun di baris lain pada batch yang sama). Suffix `-2`, `-3`, ... dipakai
 * sampai total panjang tidak melebihi 30 karakter.
 */
export function deriveUniqueUsername(
  nickname: string,
  fullName: string,
  taken: ReadonlySet<string>,
): string {
  const base = deriveBaseUsername(nickname, fullName);
  if (!taken.has(base)) return base;

  for (let suffixNumber = 2; suffixNumber <= 9999; suffixNumber++) {
    const suffix = `-${suffixNumber}`;
    const candidate = `${base.slice(0, MAX_TOTAL - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Praktis tidak tercapai; jaga-jaga agar fungsi tetap total.
  throw new Error("Tidak dapat menurunkan username unik.");
}
