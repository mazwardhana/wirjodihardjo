"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

let toastListeners: ((t: Toast) => void)[] = [];

export function toast(type: ToastType, message: string) {
  const id = crypto.randomUUID();
  toastListeners.forEach((l) => l({ id, type, message }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[400] flex flex-col gap-2 sm:bottom-4">
      {toasts.map((t) => {
        const bg =
          t.type === "success"
            ? "bg-forest text-cream"
            : t.type === "error"
              ? "bg-wood text-cream"
              : "bg-gold-deep text-cream";
        // error → penting (alert, assertive); success/info → status ringan.
        const role = t.type === "error" ? "alert" : "status";
        const live = t.type === "error" ? "assertive" : "polite";
        return (
          <div
            key={t.id}
            role={role}
            aria-live={live}
            className={`rounded-md px-4 py-3 text-sm shadow-lg ${bg}`}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}