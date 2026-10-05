import type { ReunionAttendanceResult } from "@/lib/statistik";

/**
 * Rekap kehadiran per keluarga cabang untuk halaman publik reuni.
 *
 * Server component murni: seluruh angka sudah dihitung `statistik.ts`, jadi
 * komponen ini hanya menyusun tabel yang bisa dibaca pembaca layar maupun
 * dicetak.
 */
export function ReunionAttendanceByBranch({
  attendanceByBranch,
}: {
  attendanceByBranch: ReunionAttendanceResult;
}) {
  const { rows, total } = attendanceByBranch;

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-wood/30 bg-parchment/40 px-5 py-4 text-sm text-muted">
        Belum ada keluarga cabang yang tercatat, jadi rekap kehadiran belum bisa
        disusun.
      </p>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="rekap-kehadiran">
      <h2
        id="rekap-kehadiran"
        className="font-display text-lg font-semibold text-forest"
      >
        Kehadiran per keluarga cabang
      </h2>
      <p className="mt-1 text-sm text-muted">
        Hanya peserta yang hadir yang dihitung. Daftar tunggu tetap punya
        peluang datang.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <caption className="sr-only">
            Jumlah peserta yang hadir per keluarga cabang untuk reuni ini.
          </caption>
          <thead>
            <tr className="border-b border-wood/15">
              <th scope="col" className="py-2 pr-3 text-sm font-semibold text-forest">
                Keluarga cabang
              </th>
              <th
                scope="col"
                className="py-2 pl-3 text-right text-sm font-semibold text-forest"
              >
                Hadir
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.branchId ?? "__unassigned__"} className="border-b border-wood/10">
                <th
                  scope="row"
                  className="break-words py-2 pr-3 text-sm font-normal text-ink"
                >
                  {row.branchNumber !== null && (
                    <span className="mr-2 tabular-nums text-muted">
                      {row.branchNumber}.
                    </span>
                  )}
                  {row.branchName}
                </th>
                <td className="py-2 pl-3 text-right text-sm tabular-nums text-ink">
                  {row.attending}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-wood/15">
              <th scope="row" className="py-2 pr-3 text-sm font-semibold text-forest">
                Total
              </th>
              <td className="py-2 pl-3 text-right text-sm font-semibold tabular-nums text-forest">
                {total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}