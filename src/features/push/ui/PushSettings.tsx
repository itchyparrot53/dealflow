"use client";
import type React from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getIosSnapshot,
  getStandaloneSnapshot,
  noopSubscribe,
  subscribeStandalone,
} from "@/features/pwa/installPrompt";
import { trpc } from "@/lib/trpc-client";
import { EnablePushButton } from "./EnablePushButton";

type PushStatus = "checking" | "unsupported" | "not-configured" | "off" | "on";

const STATUS_TEXT: Record<PushStatus, string> = {
  checking: "Checking push support...",
  unsupported: "Not supported in this browser",
  "not-configured": "Not set up on this server",
  off: "Push is off",
  on: "Push is on for this device",
};

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// The per-device half of the push settings. The server config says whether push is set up at
// all; the browser's PushManager says whether this device has a live subscription.
export function PushSettings(): React.ReactNode {
  const config = trpc.push.config.useQuery();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const ios = useSyncExternalStore(noopSubscribe, getIosSnapshot, () => false);
  const standalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      if (!supported()) {
        setStatus("unsupported");
        return;
      }
      const data = config.data;
      if (data === undefined) return;
      if (!data.enabled || data.publicKey === "") {
        setStatus("not-configured");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (run.cancelled) return;
      setEndpoint(subscription?.endpoint ?? null);
      setStatus(subscription === undefined || subscription === null ? "off" : "on");
    })();
    return () => {
      run.cancelled = true;
    };
  }, [config.data]);

  const publicKey = config.data?.publicKey ?? "";
  return (
    <div data-testid="push-settings" className="space-y-3 p-5">
      <p data-testid="push-status" className="text-sm font-medium">
        {STATUS_TEXT[status]}
      </p>
      <p className="text-sm text-muted-foreground">
        Push notifications open the same link as the in-app notification, on this device only.
      </p>
      {ios && !standalone && (
        <p className="text-xs text-muted-foreground">
          On iOS, add Dealflow to the Home Screen first. Push needs iOS 16.4 or later.
        </p>
      )}
      {(status === "off" || status === "on") && (
        <EnablePushButton
          publicKey={publicKey}
          subscribed={status === "on"}
          onSubscribed={(nextEndpoint) => {
            setEndpoint(nextEndpoint);
            setStatus(nextEndpoint === null ? "off" : "on");
          }}
        />
      )}
      {endpoint !== null && (
        <p className="truncate text-xs text-muted-foreground">This device is registered.</p>
      )}
    </div>
  );
}
