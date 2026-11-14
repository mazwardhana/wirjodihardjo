// Bantuan kontekstual yang dapat diakses: memakai <details>/<summary> bawaan
// peramban sehingga dapat dibuka/ditutup dengan keyboard tanpa JavaScript.
export function ContextualHelp({
  title = "Panduan halaman ini",
  children,
}: {
  title?: string;
  children: string;
}) {
  return (
    <details className="mt-4 max-w-2xl rounded-md border border-wood/25 bg-parchment/60 px-4 py-3 text-sm text-forest">
      <summary className="min-h-11 cursor-pointer py-2 font-medium text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
        {title}
      </summary>
      <p className="pb-1 leading-6 text-wood">{children}</p>
    </details>
  );
}