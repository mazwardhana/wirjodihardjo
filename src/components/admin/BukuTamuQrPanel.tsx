import QRCode from "qrcode";
import { PrintButton } from "./PrintButton";

/**
 * QR buku tamu: satu QR untuk semua cabang. Dibuat di server sebagai SVG
 * inline supaya tidak perlu canvas di browser dan bisa langsung dicetak.
 * `qrcode` dipilih karena murni JS tanpa dependensi native.
 */

/** Alamat buku tamu dari NEXTAUTH_URL (atau base apa pun), tanpa garis ganda. */
export function buildCheckInUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  return `${trimmed}/reuni/buku-tamu`;
}

/** QR sebagai string SVG untuk disisipkan langsung ke halaman. */
export function renderQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, width: 512 });
}

export async function BukuTamuQrPanel({ url }: { url: string }) {
  const svg = await renderQrSvg(url);

  return (
    <div className="print-area rounded-lg border border-wood/15 bg-cream p-5 sm:max-w-md">
      <div
        className="qr-svg mx-auto w-56 max-w-full [&>svg]:h-auto [&>svg]:w-full"
        // SVG dari `qrcode` murni geometri yang dibuat dari teks URL milik
        // sendiri, bukan input pengguna, jadi aman disisipkan.
        dangerouslySetInnerHTML={{ __html: svg }}
        role="img"
        aria-label={`QR code menuju buku tamu di ${url}`}
      />
      <p className="mt-3 break-all text-center text-xs text-muted">{url}</p>
      <p className="mt-1 text-center text-xs text-muted">
        Satu QR untuk semua cabang. Tempel di meja registrasi, tamu memindai lalu
        mengisi buku tamu sendiri.
      </p>
      <div className="mt-4 flex justify-center">
        <PrintButton />
      </div>
    </div>
  );
}
