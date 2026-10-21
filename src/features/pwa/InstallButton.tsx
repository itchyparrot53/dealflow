"use client";
import { Download, Share } from "lucide-react";
import type React from "react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  getInstallPrompt,
  getIosSnapshot,
  getStandaloneSnapshot,
  noopSubscribe,
  promptInstall,
  startInstallPromptCapture,
  subscribeInstallPrompt,
  subscribeStandalone,
} from "./installPrompt";

const IOS_INSTRUCTIONS = "Add to Home Screen: tap Share, then Add to Home Screen";
const BROWSER_HINT = "Use your browser's Install option to add Dealflow to your device.";

// "Install app" appears in the account menu and in Settings > Profile. The menu only offers an
// actionable prompt (an instruction with no button would just close the menu); Settings explains
// the iOS route and falls back to the browser menu hint, so every browser has an entry.
export function InstallButton({
  variant = "settings",
}: {
  variant?: "menu" | "settings";
}): React.ReactNode {
  const promptReady = useSyncExternalStore(
    subscribeInstallPrompt,
    () => getInstallPrompt() !== null,
    () => false,
  );
  const standalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);
  const ios = useSyncExternalStore(noopSubscribe, getIosSnapshot, () => false);

  useEffect(() => {
    startInstallPromptCapture();
  }, []);

  // An installed app has nothing to install, so the entry disappears.
  if (standalone) return null;
  if (variant === "menu" && !promptReady) return null;

  const icon = <Download aria-hidden="true" className="h-4 w-4 text-muted-foreground" />;

  if (variant === "menu") {
    return (
      <DropdownMenuItem asChild className="gap-2.5">
        <button
          type="button"
          data-testid="install-app"
          onClick={() => {
            void promptInstall();
          }}
        >
          {icon}
          Install app
        </button>
      </DropdownMenuItem>
    );
  }

  if (promptReady) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="install-app"
          onClick={() => {
            void promptInstall();
          }}
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Install app
        </Button>
        <p className="text-sm text-muted-foreground">
          Adds Dealflow to your device and opens it in its own window.
        </p>
      </div>
    );
  }

  if (ios) {
    return (
      <div className="flex items-start gap-3" data-testid="install-app">
        <Share aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{IOS_INSTRUCTIONS}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3" data-testid="install-app">
      <Download aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{BROWSER_HINT}</p>
    </div>
  );
}
