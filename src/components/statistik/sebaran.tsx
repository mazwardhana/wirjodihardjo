import { angka } from "./shared";
import type { BranchStat } from "@/lib/statistik";
import { EmptyState } from "@/components/ui/States";

/**
 * Tabel sebaran anggota per keluarga cabang. Halaman publik menampilkan
 * batang porsi; halaman admin menambahkan kolom hidup/wafat + baris total.
 */

function BarisKeluarga({
  branch,
  terbesar,
}: {
  branch: BranchStat;
  terbesar: number;
}) {
  // Batang 0% itu disengaja: keluarga tanpa anggota harus terbaca kosong,
  // bukan tersirat punya sedikit anggota.
  const lebar =
    branch.total === 0 || terbesar === 0
      ? 0
      : Math.max(3, Math.round((branch.total / terbesar) * 100));

  return (
    <tr className="border-b border-wood/15 align-top">
      {/* Batang di sel terakhir disembunyikan dari pembaca layar karena
          angkanya sudah tertulis lengkap di dua sel sebelumnya. */}
      <th scope="row" className="break-words py-3 pr-3 font-normal">
        <span className="block text-sm font-medium text-balance text-forest">
          {branch.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          Cabang {branch.branchNumber}
          {branch.total === 0
            ? " · belum ada anggota tercatat"
            : ` · ${angka(branch.living)} hidup, ${angka(branch.deceased)} wafat`}
        </span>
      </th>
      <td className="py-3 px-3 text-right font-display text-lg font-semibold text-forest tabular-nums">
        {angka(branch.total)}
      </td>
      <td className="py-3 pl-3">
        <span aria-hidden="true" className="block h-2.5 w-full rounded-sm bg-parchment ring-1 ring-inset ring-wood/20">
          <span
            className="block h-full rounded-sm bg-wood/80"
            style={{ width: `${lebar}%` }}
          />
        </span>
      </td>
    </tr>
  );
}

/** Tabel sebaran dengan batang porsi — versi halaman publik. */
export function SebaranCabangPublik({
  branches,
  unassigned,
}: {
  branches: BranchStat[];
  unassigned: number;
}) {
  const peringkat = [...branches].sort(
    (a, b) => b.total - a.total || a.branchNumber - b.branchNumber,
  );
  const terbesar = peringkat.reduce((maks, b) => Math.max(maks, b.total), 0);
  const jumlahDitugaskan = peringkat.reduce((sum, b) => sum + b.total, 0);

  if (peringkat.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          title="Belum ada keluarga cabang"
          description="Daftar keluarga cabang dibuat oleh admin Family. Setelah ada, jumlah anggota tiap keluarga akan tampil di sini beserta batangnya."
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left">
            <caption className="sr-only">
              Jumlah anggota tiap keluarga cabang, diurutkan dari yang paling
              banyak. Kolom porsi memuat batang yang lebarnya sebanding
              dengan keluarga cabang terbesar.
            </caption>
            <thead>
              <tr className="border-b border-wood/25">
                <th scope="col" className="w-[45%] py-2 pr-3 text-sm font-semibold text-forest">
                  Keluarga besar
                </th>
                <th scope="col" className="w-20 py-2 px-3 text-right text-sm font-semibold text-forest">
                  Anggota
                </th>
                <th scope="col" className="w-24 py-2 pl-3 text-sm font-semibold text-forest sm:w-32">
                  Porsi
                </th>
              </tr>
            </thead>
            <tbody>
              {peringkat.map((branch) => (
                <BarisKeluarga key={branch.id} branch={branch} terbesar={terbesar} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        {angka(jumlahDitugaskan)} anggota sudah ditugaskan ke keluarga
        cabang.{" "}
        {unassigned > 0 ? (
          <span className="text-wood">
            {angka(unassigned)} anggota lain belum ditugaskan ke
            keluarga cabang mana pun
          </span>
        ) : (
          <span>Tidak ada anggota yang belum ditugaskan.</span>
        )}
      </p>
    </>
  );
}

/** Tabel sebaran + baris total — versi halaman admin. */
export function SebaranCabangAdmin({ branches }: { branches: BranchStat[] }) {
  const totalCabang = branches.reduce((sum, b) => sum + b.total, 0);
  const hidupCabang = branches.reduce((sum, b) => sum + b.living, 0);
  const wafatCabang = branches.reduce((sum, b) => sum + b.deceased, 0);

  if (branches.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Belum ada keluarga besar"
          description="Buat cabang di menu Cabang supaya sebaran anggota bisa dihitung per keluarga besar."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-wood/15">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">
          Sebaran anggota per keluarga besar: jumlah total, yang masih
          hidup, dan yang sudah wafat.
        </caption>
        <thead>
          <tr className="border-b border-wood/15 bg-parchment/40 text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3">Keluarga besar</th>
            <th scope="col" className="px-4 py-3 text-right">Total</th>
            <th scope="col" className="px-4 py-3 text-right">Hidup</th>
            <th scope="col" className="px-4 py-3 text-right">Wafat</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id} className="border-t border-wood/15">
              <th scope="row" className="px-4 py-3 text-left font-semibold text-forest">
                <span className="block break-words">{branch.name}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  Cabang {branch.branchNumber}
                </span>
              </th>
              <td className="px-4 py-3 text-right tabular-nums">{angka(branch.total)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{angka(branch.living)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{angka(branch.deceased)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-wood/25 font-semibold text-forest">
            <th scope="row" className="px-4 py-3 text-left">Seluruh keluarga besar</th>
            <td className="px-4 py-3 text-right tabular-nums">{angka(totalCabang)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{angka(hidupCabang)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{angka(wafatCabang)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
