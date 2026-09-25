import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tentang",
  description: "Sejarah dan struktur keluarga besar Wirjodihardjo.",
};

export default function TentangPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-display text-sm font-medium tracking-wide text-gold-deep">
        Warisan
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-forest sm:text-4xl">
        Tentang Keluarga
      </h1>

      <div className="motif-divider my-6" aria-hidden="true" />

      <div className="space-y-5 leading-relaxed text-muted">
        <p>
          Keluarga besar Wirjodihardjo berawal dari pasangan Tn. Wirjodihardjo
          dan Ny. Wirjodihardjo. Sepuluh anak mereka menjadi cikal bakal
          sepuluh cabang keturunan yang terus bertumbuh lintas generasi.
        </p>
        <p>
          Website ini adalah proyek bersama keluarga untuk mencatat silsilah,
          menyimpan dokumentasi, dan menjaga silaturahmi — sehingga tidak ada
          anggota yang terlewat dari catatan keluarga.
        </p>
      </div>

      <h2 className="mt-12 font-display text-2xl font-semibold text-forest">
        Penamaan Generasi dalam Adat Jawa
      </h2>
      <p className="mt-3 leading-relaxed text-muted">
        Dalam tradisi Jawa, setiap tingkat keturunan ke bawah (turunan mudhun)
        memiliki nama spesifik. Label ini digunakan di dalam pohon silsilah
        untuk menandai posisi setiap anggota.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-wood/15">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-wood/15 bg-parchment/60">
              <th className="px-4 py-3 font-display font-semibold text-forest">
                Tingkat
              </th>
              <th className="px-4 py-3 font-display font-semibold text-forest">
                Sebutan Jawa
              </th>
              <th className="px-4 py-3 font-display font-semibold text-forest">
                Padanan Indonesia
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [0, "Leluhur / Pendiri", "Pendiri Keluarga"],
              [1, "Anak", "Anak"],
              [2, "Putu / Wayah", "Cucu"],
              [3, "Buyut", "Cicit"],
              [4, "Canggah", "Piut"],
              [5, "Wareng", "Anggas"],
              [6, "Udheg-udheg", "-"],
              [7, "Gantung siwur", "-"],
              [8, "Gropak senthe", "-"],
              [9, "Debog bosok", "-"],
              [10, "Galih asem", "-"],
              [11, "Gropak waton", "-"],
              [12, "Cendheng", "-"],
              [13, "Giyeng", "-"],
              [14, "Cumpleng", "-"],
              [15, "Ampleng", "-"],
              [16, "Menyaman", "-"],
              [17, "Menya-menya", "-"],
              [18, "Trah tumerah", "-"],
            ].map(([level, jawa, indonesia]) => (
              <tr
                key={level}
                className="border-b border-wood/10 last:border-0"
              >
                <td className="px-4 py-2.5 text-wood">{level as number}</td>
                <td className="px-4 py-2.5 font-medium text-forest">{jawa as string}</td>
                <td className="px-4 py-2.5 text-muted">{indonesia as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm italic text-muted">
        Sumber: budaya.jogjaprov.go.id, detikJateng, ANTARA
      </p>
    </div>
  );
}