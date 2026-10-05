import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  genderShort,
  type PublicMembersResult,
  type RegistryBranch,
} from "@/lib/registrasi-registry";

/**
 * Daftar anggota buku besar untuk dibaca publik: siapa saja yang tercatat,
 * per keluarga cabang. Ditulis sebagai komponen server dengan form GET —
 * tanpa JavaScript, filter dan paginasi tetap berfungsi lewat URL.
 *
 * `basePath` menentukan ke mana filter dan paginasi mengirim pengguna, supaya
 * komponen ini tetap benar baik di halaman daftar penuh maupun dipanggil dari
 * halaman lain.
 */
export function MemberRegistry({
  result,
  branches,
  branchId,
  q,
  basePath,
  headingLevel = "h2",
}: {
  result: PublicMembersResult;
  branches: RegistryBranch[];
  branchId: string;
  q: string;
  /** Path halaman pemanggil; filter dibangun relatif terhadapnya. */
  basePath: string;
  /**
   * Tag judul bagian. Halaman daftar penuh memakainya sebagai `h1`; di
   * halaman registrasi yang punya judul sendiri, cukup `h2` (bawaan).
   */
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  /** Bangun URL untuk halaman/tetapan filter tertentu. */
  function href(next: { page?: number; branchId?: string; q?: string }): string {
    const params = new URLSearchParams();
    const nextBranch = next.branchId ?? branchId;
    const nextQ = next.q ?? q;
    if (nextBranch) params.set("branchId", nextBranch);
    if (nextQ) params.set("q", nextQ);
    const page = next.page ?? 1;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <section aria-labelledby="judul-daftar-anggota" id="daftar-anggota" className="scroll-mt-24">
      <div className="border-t border-wood/20 pt-8">
        <Heading
          id="judul-daftar-anggota"
          className="flex items-center gap-2 font-display text-xl font-semibold text-forest sm:text-2xl"
        >
          <span aria-hidden="true" className="text-wood">
            <IkonBuku />
          </span>
          Daftar anggota tercatat
        </Heading>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Seluruh anggota yang sudah tercatat di buku besar keluarga, beserta
          keluarga cabang asalnya. Gunakan filter di bawah untuk menelusuri satu
          keluarga besar atau mencari nama.
        </p>
      </div>

      {/* Filter. Form GET tanpa JS: pilih cabang + tulis nama, lalu Enter. */}
      <form
        method="get"
        action={basePath}
        className="mt-6 flex flex-wrap items-end gap-3"
        aria-label="Saring daftar anggota"
      >
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="daftar-cabang"
            className="block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Keluarga cabang
          </label>
          <select
            id="daftar-cabang"
            name="branchId"
            defaultValue={branchId}
            className="mt-1.5 min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink focus:border-forest/70"
          >
            <option value="">Semua keluarga cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="daftar-cari"
            className="block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Cari nama
          </label>
          <input
            id="daftar-cari"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Nama lengkap atau panggilan"
            className="mt-1.5 min-h-11 w-full rounded-sm border border-wood/35 bg-cream px-3 py-2 text-sm text-ink placeholder:text-muted/80 focus:border-forest/70"
          />
        </div>

        <button
          type="submit"
          className="min-h-11 rounded-sm bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Terapkan
        </button>

        {(branchId || q) && (
          <Link
            href={basePath}
            className="min-h-11 rounded-sm border border-wood/35 px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Ringkasan jumlah + rentang baris halaman ini. */}
      <p className="mt-4 text-sm text-muted" role="status">
        {result.total === 0 ? (
          <>Tidak ada anggota yang cocok.</>
        ) : (
          <>
            Menampilkan <span className="font-semibold text-forest">{from}–{to}</span>{" "}
            dari <span className="font-semibold text-forest">{result.total}</span> anggota
            {branchId && <> di keluarga cabang terpilih</>}.
          </>
        )}
      </p>

      {result.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Belum ada anggota yang cocok"
            description={
              branchId || q
                ? "Tidak ada anggota yang cocok dengan saringan ini. Coba ganti keluarga cabang atau ubah kata kunci pencarian."
                : "Buku besar keluarga masih kosong. Anggota akan tampil di sini begitu diisi lewat form registrasi atau oleh admin."
            }
            action={
              (branchId || q) ? (
                <Link
                  href={basePath}
                  className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-forest-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Lihat seluruh anggota
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">
              Anggota buku besar keluarga beserta keluarga cabang, nama panggilan,
              nama lengkap, dan jenis kelaminnya.
            </caption>
            <thead>
              <tr className="border-b border-wood/25">
                <th scope="col" className="py-2 pr-3 text-sm font-semibold text-forest">
                  Anggota keluarga cabang
                </th>
                <th scope="col" className="py-2 px-3 text-sm font-semibold text-forest">
                  Nama panggilan
                </th>
                <th scope="col" className="py-2 px-3 text-sm font-semibold text-forest">
                  Nama lengkap
                </th>
                <th scope="col" className="py-2 pl-3 text-sm font-semibold text-forest">
                  Jenis kelamin
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-wood/15 align-top">
                  <th scope="row" className="break-words py-3 pr-3 font-normal">
                    <span className="block text-sm text-balance text-forest">
                      {row.branchName ?? <span className="text-muted">Belum ditugaskan</span>}
                    </span>
                    {/* Penanda asal: hanya untuk baris yang lahir dari form/impor
                        registrasi. Data lama tanpa batch tidak diberi lencana
                        apa pun, supaya tidak terbaca sebagai "bukan anggota". */}
                    {row.fromRegistration && (
                      <span className="mt-1 inline-block rounded-sm bg-gold-deep/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-gold-deep">
                        Via form registrasi
                      </span>
                    )}
                  </th>
                  <td className="break-words py-3 px-3 text-sm text-ink">
                    {row.namaPanggilan || <span className="text-muted">—</span>}
                  </td>
                  <td className="break-words py-3 px-3 text-sm text-ink">{row.fullName}</td>
                  <td className="py-3 pl-3 text-sm text-muted">
                    {/* Singkatan L/P dipertahankan agar kolom tetap ramping di
                        layar sempit; label panjang ada di `title`. */}
                    <span title={row.gender === "MALE" ? "Laki-laki" : row.gender === "FEMALE" ? "Perempuan" : "Lainnya"}>
                      {genderShort(row.gender)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginasi: hanya tampil bila ada lebih dari satu halaman. */}
      {totalPages > 1 && (
        <nav
          aria-label="Halaman daftar anggota"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          {result.page > 1 ? (
            <Link
              href={href({ page: result.page - 1 })}
              rel="prev"
              className="min-h-11 rounded-sm border border-wood/35 px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Sebelumnya
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="min-h-11 cursor-not-allowed rounded-sm border border-wood/15 px-4 py-2 text-sm font-medium text-muted/60"
            >
              Sebelumnya
            </span>
          )}

          <span className="px-2 text-sm text-muted tabular-nums">
            Halaman {result.page} dari {totalPages}
          </span>

          {result.page < totalPages ? (
            <Link
              href={href({ page: result.page + 1 })}
              rel="next"
              className="min-h-11 rounded-sm border border-wood/35 px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Berikutnya
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="min-h-11 cursor-not-allowed rounded-sm border border-wood/15 px-4 py-2 text-sm font-medium text-muted/60"
            >
              Berikutnya
            </span>
          )}
        </nav>
      )}
    </section>
  );
}

function IkonBuku() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}
