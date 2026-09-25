import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Penjaga awal: hanya memeriksa ada/tidaknya cookie sesi.
 * Pemeriksaan peran dan kepemilikan data dilakukan di setiap halaman/server
 * component lewat auth(), bukan di sini, sehingga tidak ada dependensi berat
 * (Prisma, bcrypt) yang ikut ke bundel proxy.
 */
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};