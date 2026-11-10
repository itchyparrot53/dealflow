"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { confirmDoubleOptIn } from "@/features/marketing/doubleOptIn";
import { clientIp } from "@/features/net/clientIp";

// The POST half of /c/{token}. GET only renders; this consumes the single-use token and flips the
// contact to subscribed, so a prefetching scanner cannot confirm a subscription by itself.
export async function confirmSubscriptionAction(formData: FormData): Promise<void> {
  const raw = formData.get("token");
  const token = typeof raw === "string" ? raw : "";
  const requestHeaders = await headers();
  const result = await confirmDoubleOptIn(
    db,
    token,
    {
      ip: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
    },
    AbortSignal.timeout(10_000),
  );
  if (!result.ok) redirect(`/c/${encodeURIComponent(token)}?state=expired`);
  redirect(`/c/${encodeURIComponent(token)}?state=subscribed`);
}
