/**
 * Sumber kebenaran flag `mustChangeCredentials` ada di database, sedangkan JWT
 * menyimpan salinannya saat login. Onboarding menyetelnya false, tetapi token
 * lama tetap membawa true sehingga pengguna terlempar balik dari /dashboard ke
 * /onboarding, lalu pengiriman ulang ditolak 403 oleh rute onboarding.
 *
 * Sinkronisasi hanya dijalankan selama token masih true. Pengguna yang sudah
 * selesai tidak lagi membayar satu query database per permintaan sesi.
 */
export type CredentialFlagLookup = (userId: string) => Promise<boolean | null>;

type FlagToken = Record<string, unknown>;

export async function resolveCredentialFlag(
  token: FlagToken,
  lookup: CredentialFlagLookup,
): Promise<boolean> {
  if (token.mustChangeCredentials !== true) return false;
  if (typeof token.id !== "string" || token.id.length === 0) return true;
  const current = await lookup(token.id);
  return current !== false;
}
