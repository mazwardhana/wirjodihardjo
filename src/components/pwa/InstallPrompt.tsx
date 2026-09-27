'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;
const INSTALL_DELAY = 2000;

function isDismissedRecently(): boolean {
  const lastDismissed = localStorage.getItem(DISMISS_KEY);
  if (!lastDismissed) return false;

  const timestamp = Number.parseInt(lastDismissed, 10);
  return Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_DURATION;
}

function isInstalled(): boolean {
  const inDisplayMode = window.matchMedia('(display-mode: standalone)').matches;
  const iosNavigator = window.navigator as NavigatorWithStandalone;
  return inDisplayMode || iosNavigator.standalone === true;
}

function isIOSDevice(): boolean {
  const userAgent = window.navigator.userAgent;
  const isIPadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(userAgent) || isIPadOS;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (isInstalled() || isDismissedRecently()) return;

    const iosDevice = isIOSDevice();
    setIsIOS(iosDevice);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const showAfterDelay = () => {
      timer = setTimeout(() => setShowPrompt(true), INSTALL_DELAY);
    };

    if (iosDevice) {
      showAfterDelay();
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      showAfterDelay();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setShowPrompt(false);
    } else {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowPrompt(false);
    setShowIOSInstructions(false);
  };

  if (!showPrompt) return null;

  if (showIOSInstructions) {
    return (
      <div
        role="dialog"
        aria-label="Petunjuk pemasangan di iOS"
        className="fixed inset-x-0 bottom-0 z-[150] border-t-2 border-gold bg-cream px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
      >
        <div className="mx-auto max-w-2xl">
          <h3 className="mb-2 font-serif text-lg font-semibold text-forest">
            Cara Memasang di iOS
          </h3>
          <p className="mb-4 text-sm text-ink">
            Di Safari, ketuk ikon Bagikan lalu pilih &quot;Tambahkan ke Layar Utama&quot;
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-11 w-full rounded-md border-2 border-forest bg-transparent px-4 py-2 font-medium text-forest hover:bg-forest hover:text-cream focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Mengerti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi keluarga Wirjodihardjo"
      className="fixed inset-x-0 bottom-0 z-[150] border-t-2 border-gold bg-cream px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
    >
      <div className="mx-auto max-w-2xl">
        <h3 className="mb-2 font-serif text-lg font-semibold text-forest">
          Pasang Aplikasi
        </h3>
        <p className="mb-4 text-sm text-ink">
          Akses lebih cepat ke platform keluarga Wirjodihardjo dari layar utama perangkat Anda.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-11 flex-1 rounded-md bg-forest px-4 py-2 font-medium text-cream hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Pasang
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-11 flex-1 rounded-md border-2 border-forest bg-transparent px-4 py-2 font-medium text-forest hover:bg-forest hover:text-cream focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2"
          >
            Nanti dulu
          </button>
        </div>
      </div>
    </div>
  );
}
