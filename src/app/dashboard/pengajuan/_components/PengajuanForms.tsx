"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Form pengajuan area member. Dikolokasikan di dalam folder rute agar
 * navigasi sukses bisa langsung membuka halaman detail pengajuan
 * (konfirmasi) dan pesan validasi API bisa ditampilkan ke anggota.
 */

const inputCls =
  "mt-1 block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const submitCls =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50";

const cancelCls =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-wood/30 px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const errorCls = "rounded-md bg-wood/10 p-3 text-sm text-wood";

type ApiFailure = {
  error?: string;
  issues?: Record<string, string[] | undefined>;
};

/** Ambil pesan kesalahan API, termasuk pesan per-field bila ada. */
async function readErrorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as ApiFailure | null;
  const fieldMessages = data?.issues
    ? Object.values(data.issues)
        .flat()
        .filter((m): m is string => Boolean(m))
    : [];
  if (fieldMessages.length > 0) return fieldMessages.join(" ");
  return data?.error ?? "Gagal mengajukan. Coba lagi.";
}

/** Kirim pengajuan lalu buka halaman detail sebagai konfirmasi. */
async function submitPengajuan(
  router: ReturnType<typeof useRouter>,
  setError: (message: string) => void,
  setLoading: (value: boolean) => void,
  body: Record<string, unknown>,
): Promise<void> {
  setLoading(true);
  setError("");
  try {
    const res = await fetch("/api/pengajuan/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await readErrorMessage(res));
      return;
    }
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    router.push(
      data?.id
        ? `/dashboard/pengajuan/${data.id}?sukses=1`
        : "/dashboard/pengajuan",
    );
  } catch {
    setError("Gagal menghubungi server. Periksa koneksi lalu coba lagi.");
  } finally {
    setLoading(false);
  }
}

function FormActions({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={loading} className={submitCls}>
        {loading ? "Mengajukan..." : "Ajukan"}
      </button>
      <Link href="/dashboard/pengajuan" className={cancelCls}>
        Batal
      </Link>
    </div>
  );
}

export function AddChildForm({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [birthPlace, setBirthPlace] = useState("");
  const [isStep, setIsStep] = useState(false);
  const [isAdopted, setIsAdopted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitPengajuan(router, setError, setLoading, {
      type: "ADD_CHILD",
      parentId: personId,
      fullName: name,
      gender,
      birthPlace: birthPlace || undefined,
      isStep,
      isAdopted,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted">
        Anak dari: <span className="font-medium text-forest">{personName}</span>
      </p>

      <div>
        <label htmlFor="anak-nama" className="block text-sm font-medium text-forest">
          Nama Lengkap Anak
        </label>
        <input
          id="anak-nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="anak-gender" className="block text-sm font-medium text-forest">
          Jenis Kelamin
        </label>
        <select
          id="anak-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className={inputCls}
        >
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor="anak-tempat-lahir" className="block text-sm font-medium text-forest">
          Tempat Lahir
        </label>
        <input
          id="anak-tempat-lahir"
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={isStep}
            onChange={(e) => setIsStep(e.target.checked)}
            className="h-4 w-4 accent-forest"
          />
          Anak tiri
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={isAdopted}
            onChange={(e) => setIsAdopted(e.target.checked)}
            className="h-4 w-4 accent-forest"
          />
          Anak angkat
        </label>
      </div>

      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}

      <FormActions loading={loading} />
    </form>
  );
}

export function AddSpouseForm({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [marriageDate, setMarriageDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitPengajuan(router, setError, setLoading, {
      type: "ADD_SPOUSE",
      personId,
      fullName: name,
      gender,
      marriageDate: marriageDate || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted">
        Pasangan dari:{" "}
        <span className="font-medium text-forest">{personName}</span>
      </p>

      <div>
        <label htmlFor="pasangan-nama" className="block text-sm font-medium text-forest">
          Nama Lengkap Pasangan
        </label>
        <input
          id="pasangan-nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="pasangan-gender" className="block text-sm font-medium text-forest">
          Jenis Kelamin
        </label>
        <select
          id="pasangan-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className={inputCls}
        >
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="pasangan-tanggal-menikah"
          className="block text-sm font-medium text-forest"
        >
          Tanggal Menikah
        </label>
        <input
          type="date"
          id="pasangan-tanggal-menikah"
          value={marriageDate}
          onChange={(e) => setMarriageDate(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}

      <FormActions loading={loading} />
    </form>
  );
}

export function AddPersonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitPengajuan(router, setError, setLoading, {
      type: "ADD_PERSON",
      fullName: name,
      gender,
      birthDate: birthDate || undefined,
      birthPlace: birthPlace || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="anggota-nama" className="block text-sm font-medium text-forest">
          Nama Lengkap
        </label>
        <input
          id="anggota-nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label htmlFor="anggota-gender" className="block text-sm font-medium text-forest">
          Jenis Kelamin
        </label>
        <select
          id="anggota-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className={inputCls}
        >
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
          <option value="OTHER">Lainnya</option>
        </select>
      </div>

      <div>
        <label htmlFor="anggota-tanggal-lahir" className="block text-sm font-medium text-forest">
          Tanggal Lahir
        </label>
        <input
          type="date"
          id="anggota-tanggal-lahir"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="anggota-tempat-lahir" className="block text-sm font-medium text-forest">
          Tempat Lahir
        </label>
        <input
          id="anggota-tempat-lahir"
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}

      <FormActions loading={loading} />
    </form>
  );
}
