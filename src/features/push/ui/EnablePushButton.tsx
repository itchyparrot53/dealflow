"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { readCsrfToken } from "@/utils/csrfCookie";
import { subscribePushAction, unsubscribePushAction } from "../actions";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing !== undefined) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

// Asks for notification permission, subscribes this device with the server's VAPID public key,
// and records the subscription server-side. The private key never reaches this code.
export function EnablePushButton({
  publicKey,
  subscribed,
  onSubscribed,
}: {
  publicKey: string;
  subscribed: boolean;
  onSubscribed: (endpoint: string | null) => void;
}): React.ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications are blocked for this site. Allow them in the browser settings.");
        return;
      }
      const registration = await currentRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const keys = subscription.toJSON().keys;
      const result = await subscribePushAction(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" },
          userAgent: navigator.userAgent,
        },
        readCsrfToken(),
      );
      if (!result.ok) {
        setError(`Could not save this device (${result.error.id}).`);
        return;
      }
      onSubscribed(subscription.endpoint);
    } catch {
      setError("Could not enable push on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription !== null && subscription !== undefined) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const result = await unsubscribePushAction({ endpoint }, readCsrfToken());
        if (!result.ok) setError(`Could not remove this device (${result.error.id}).`);
      }
      onSubscribed(null);
    } catch {
      setError("Could not turn push off on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        data-testid="push-enable"
        variant={subscribed ? "outline" : "default"}
        disabled={busy}
        onClick={() => void (subscribed ? disable() : enable())}
      >
        {subscribed ? "Turn off on this device" : "Enable push"}
      </Button>
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
