/**
 * Pembatas laju di memori proses. Tidak ada klien Redis di repositori, dan
 * compose hanya menjalankan satu instance aplikasi, jadi Map lokal cukup.
 * Bila nanti ada lebih dari satu instance, ganti isi modul ini dengan ioredis
 * tanpa mengubah pemanggil.
 */

export type RateLimiter = {
  consume(key: string, limit: number, windowMs: number): boolean;
  reset(): void;
};

export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    consume(key, limit, windowMs) {
      const current = now();
      // Buang stempel waktu di luar jendela agar Map tidak tumbuh tanpa batas.
      const cutoff = current - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }

      recent.push(current);
      hits.set(key, recent);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

const defaultLimiter = createRateLimiter();

/** Dipakai route: satu instance bersama untuk seluruh proses. */
export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  return defaultLimiter.consume(key, limit, windowMs);
}

/** Hanya untuk tes: mengosongkan state instance default. */
export function resetRateLimiter(): void {
  defaultLimiter.reset();
}
