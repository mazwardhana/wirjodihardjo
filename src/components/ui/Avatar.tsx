import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Avatar berbasis inisial sebagai pengganti foto.
 * Alasan: jujur sebagai placeholder, bukan foto yang dikarang (R-23).
 */
export function Avatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-lg",
    xl: "h-28 w-28 text-2xl",
  } as const;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Foto ${name}`}
        className={cn(
          "rounded-full object-cover ring-2 ring-gold/40",
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center rounded-full bg-forest/10 font-display font-semibold text-forest ring-1 ring-forest/20",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}