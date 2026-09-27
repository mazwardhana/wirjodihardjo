"use client";

import { useCallback, useEffect, useState } from "react";

export const controlClass = "mt-1 block min-h-11 w-full min-w-0 rounded-md border border-wood/30 bg-cream px-3 py-2 text-base text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
export const buttonClass = "min-h-11 rounded-md border border-wood/30 px-4 py-2 text-sm font-medium text-forest hover:bg-wood/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50";

export function useProfileCollection<T>(kind: "education" | "social", onChanged: () => void, onBusy: (busy: boolean) => void) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/profil/${kind}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!signal?.aborted) {
        setItems(data[kind === "education" ? "education" : "socialLinks"]);
        setError(null);
      }
    } catch {
      if (!signal?.aborted) setError("Data belum dapat dimuat. Coba lagi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint, kind]);
  useEffect(() => {
    const controller = new AbortController();
    // load updates state only after the network request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function mutate(method: "POST" | "PUT" | "DELETE", id?: string, body?: unknown) {
    setBusy(true);
    onBusy(true);
    setError(null);
    setNotice("");
    try {
      const response = await fetch(id ? `${endpoint}/${encodeURIComponent(id)}` : endpoint, {
        method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error();
      setNotice(method === "DELETE" ? "Data dihapus." : "Data disimpan.");
      onChanged();
      await load();
      return true;
    } catch {
      setError("Perubahan belum tersimpan. Periksa data dan coba lagi.");
      return false;
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return { items, loading, error, busy, notice, load, mutate };
}
