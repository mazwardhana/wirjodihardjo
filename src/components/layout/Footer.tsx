import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-wood/20 bg-forest text-cream">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 place-items-center rounded-md bg-gold font-display text-lg font-semibold text-forest"
                aria-hidden="true"
              >
                W
              </span>
              <span className="font-display text-lg font-semibold">
                Keluarga Besar Wirjodihardjo
              </span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/75">
              Rumah digital untuk mencatat silsilah, menyimpan kenangan, dan
              menjaga silaturahmi keluarga lintas generasi.
            </p>
          </div>

          <nav aria-label="Navigasi footer">
            <h2 className="font-display text-base font-semibold text-gold-light">
              Jelajahi
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/silsilah"
                  className="text-cream/80 transition-colors hover:text-gold-light"
                >
                  Silsilah Keluarga
                </Link>
              </li>
              <li>
                <Link
                  href="/galeri"
                  className="text-cream/80 transition-colors hover:text-gold-light"
                >
                  Galeri
                </Link>
              </li>
              <li>
                <Link
                  href="/hall-of-fame"
                  className="text-cream/80 transition-colors hover:text-gold-light"
                >
                  Hall of Fame
                </Link>
              </li>
              <li>
                <Link
                  href="/reuni"
                  className="text-cream/80 transition-colors hover:text-gold-light"
                >
                  Reuni
                </Link>
              </li>
              <li>
                <Link
                  href="/tentang"
                  className="text-cream/80 transition-colors hover:text-gold-light"
                >
                  Tentang Keluarga
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="motif-divider my-8 opacity-40" aria-hidden="true" />

        <p className="text-xs text-cream/60">
          © {year} Keluarga Besar Wirjodihardjo. Dikelola bersama oleh keluarga.
        </p>
      </div>
    </footer>
  );
}