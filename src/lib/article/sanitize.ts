/**
 * Sanitizer HTML untuk isi artikel.
 *
 * Konten berasal dari editor TipTap, tetapi tetap dibersihkan di sisi server
 * sebelum disimpan agar tidak ada tag/atribut berbahaya yang ikut tersimpan
 * dan kemudian dirender dengan dangerouslySetInnerHTML.
 *
 * Pendekatan: daftar putih (allowlist) tag dan atribut. Tag di luar daftar
 * dibuang, atribut di luar daftar dihapus, dan URL diperiksa protokolnya.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "strike",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "code",
  "pre",
  "hr",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
};

const VOID_TAGS = new Set(["br", "img", "hr"]);

function isSafeUrl(value: string): boolean {
  const url = value.trim().toLowerCase();
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/") ||
    url.startsWith("mailto:")
  );
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function filterAttributes(tag: string, attrString: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || !attrString.trim()) return "";

  const out: string[] = [];
  // Cocokkan pasangan nama="nilai", nama='nilai', atau nama=nilai.
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrRe.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (!allowed.has(name)) continue;
    if (name === "href" || name === "src") {
      if (!isSafeUrl(value)) continue;
    }
    out.push(`${name}="${escapeAttr(value)}"`);
  }

  return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeArticleHtml(input: string): string {
  if (!input) return "";

  // Buang komentar HTML dan blok script/style beserta isinya.
  let html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");

  html = html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (full, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";

      const isClosing = full.startsWith("</");
      if (isClosing) {
        return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      }

      const attrs = filterAttributes(tag, rawAttrs);
      const selfClosing = full.endsWith("/>") || VOID_TAGS.has(tag);
      return selfClosing ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
    }
  );

  return html.trim();
}

/** Ambil teks polos dari HTML (untuk ringkasan/metadata). */
export function htmlToPlainText(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
