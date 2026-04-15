import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Module-level so the event is never lost even if the hook re-mounts
let _deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWA() {
  const [canInstall, setCanInstall] = useState<boolean>(!!_deferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(
    typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      _deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      _deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = async (preferredRoute?: string): Promise<boolean> => {
    if (!_deferredPrompt) return false;

    // Save the preferred portal route so we can redirect on PWA launch
    if (preferredRoute) {
      localStorage.setItem("pwa_preferred_route", preferredRoute);
    }

    await _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;

    if (outcome === "accepted") {
      _deferredPrompt = null;
      setCanInstall(false);
    }

    return outcome === "accepted";
  };

  return { canInstall, isInstalled, install };
}
