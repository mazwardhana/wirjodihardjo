"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [nickname, setNickname] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Redirect if no session or flag is already false
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && session?.user) {
      const mustChange = (session.user as { mustChangeCredentials?: boolean }).mustChangeCredentials;
      if (!mustChange) {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      newErrors.nickname = "Nickname wajib diisi.";
    } else if (trimmedNickname.length < 2) {
      newErrors.nickname = "Nickname minimal 2 karakter.";
    } else if (trimmedNickname.length > 50) {
      newErrors.nickname = "Nickname maksimal 50 karakter.";
    }

    if (!newPassword) {
      newErrors.newPassword = "Kata sandi wajib diisi.";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Kata sandi minimal 8 karakter.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Konfirmasi kata sandi wajib diisi.";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Kata sandi dan konfirmasi tidak cocok.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setPending(true);

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Terjadi kesalahan. Coba lagi.");
        setPending(false);
        return;
      }

      // Refresh session to clear mustChangeCredentials flag from JWT
      await update();
      router.push("/dashboard/profil");
    } catch {
      setServerError("Terjadi kesalahan. Coba lagi.");
      setPending(false);
    }
  }

  // Loading state while checking session
  if (status === "loading") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-sm text-muted">Memuat...</p>
      </div>
    );
  }

  // No session, redirect will handle in useEffect
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-md px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-forest">
          Lengkapi Akun Anda
        </h1>
        <p className="mt-3 text-sm text-muted">
          Tentukan nickname dan kata sandi baru untuk mengakses platform keluarga.
        </p>
      </div>

      <div className="motif-divider my-8" />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-forest"
          >
            Nickname
          </label>
          <input
            id="nickname"
            type="text"
            required
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              if (errors.nickname) {
                setErrors((prev) => ({ ...prev, nickname: "" }));
              }
            }}
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            aria-invalid={!!errors.nickname}
            className="mt-1 block h-11 w-full rounded-md border border-wood/30 bg-cream px-4 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            placeholder="Nama panggilan Anda"
            disabled={pending}
          />
          {errors.nickname && (
            <p
              id="nickname-error"
              role="alert"
              className="mt-1.5 text-sm font-medium text-wood"
            >
              {errors.nickname}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-forest"
          >
            Kata Sandi Baru
          </label>
          <input
            id="newPassword"
            type="password"
            required
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (errors.newPassword) {
                setErrors((prev) => ({ ...prev, newPassword: "" }));
              }
            }}
            aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
            aria-invalid={!!errors.newPassword}
            className="mt-1 block h-11 w-full rounded-md border border-wood/30 bg-cream px-4 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            placeholder="Minimal 8 karakter"
            disabled={pending}
          />
          {errors.newPassword && (
            <p
              id="newPassword-error"
              role="alert"
              className="mt-1.5 text-sm font-medium text-wood"
            >
              {errors.newPassword}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-forest"
          >
            Konfirmasi Kata Sandi
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }
            }}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            aria-invalid={!!errors.confirmPassword}
            className="mt-1 block h-11 w-full rounded-md border border-wood/30 bg-cream px-4 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            placeholder="Ulangi kata sandi"
            disabled={pending}
          />
          {errors.confirmPassword && (
            <p
              id="confirmPassword-error"
              role="alert"
              className="mt-1.5 text-sm font-medium text-wood"
            >
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {serverError && (
          <p role="alert" className="rounded-md border border-wood/30 bg-wood/10 px-4 py-3 text-sm font-medium text-wood">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-gold px-5 text-sm font-semibold text-forest transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Memproses..." : "Simpan dan Lanjutkan"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Setelah disimpan, Anda dapat masuk dengan nickname dan kata sandi baru.
      </p>
    </div>
  );
}
