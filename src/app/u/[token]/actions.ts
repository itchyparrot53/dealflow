"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { applyUnsubscribe, requestResubscribe } from "@/features/marketing/unsubscribe";
import { clientIp } from "@/features/net/clientIp";

// The page's two buttons. The RFC 8058 one-click path is the sibling route.ts; both share the
// same service so the status change, the event and the suppression cannot diverge.

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const raw = formData.get("token");
  const token = typeof raw === "string" ? raw : "";
  const requestHeaders = await headers();
  const result = await applyUnsubscribe(
    db,
    token,
    {
      source: "unsubscribe_link",
      ip: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
    },
    AbortSignal.timeout(10_000),
  );
  redirect(`/u/${encodeURIComponent(token)}?state=${result.ok ? "unsubscribed" : "invalid"}`);
}

export async function resubscribeAction(formData: FormData): Promise<void> {
  const raw = formData.get("token");
  const token = typeof raw === "string" ? raw : "";
  const result = await requestResubscribe(db, token, AbortSignal.timeout(10_000));
  if (!result.ok) redirect(`/u/${encodeURIComponent(token)}?state=invalid`);
  redirect(
    `/u/${encodeURIComponent(token)}?state=${result.value.limited === null ? "pending" : "limited"}`,
  );
}
