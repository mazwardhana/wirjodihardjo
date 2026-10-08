import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return printDateOnly(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return printDateAndTime(d);
}

/** formatDateTime, tapi kalau jam tengah malam (00:00 lokal) tampilkan tanggal
 * saja tanpa "pukul 00.00". Dipakai untuk jadwal reuni yang belum tahu jamnya
 * — pengunjung cukup melihat "13 Maret 2027", bukan "13 Maret 2027 pukul 00.00".
 */
export function formatDateTimeOrDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return printDateOnly(d);
  }
  return printDateAndTime(d);
}

/** Tanggal saja (dipakai oleh formatDate & formatDateTimeOrDate kalau midnight). */
function printDateOnly(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Tanggal + jam (dipakai oleh formatDateTime & formatDateTimeOrDate kalau bukan midnight). */
function printDateAndTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((p) => /[A-Za-z]/.test(p[0] ?? ""))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}