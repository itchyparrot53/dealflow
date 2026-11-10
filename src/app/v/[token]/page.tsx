import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/db/client";
import { loadCampaignWebVersion } from "@/features/campaigns/tracking/webVersion";
import { checkRateLimit } from "@/server/rateLimitGuard";

// Public web version of a campaign email (6.8). The token is the only credential and the message
// is rendered exactly as that recipient received it, without tracked links. It never records an
// open and never mutates consent. The X-Robots-Tag header is added in next.config for /v/*.

export const metadata: Metadata = {
  title: "Email",
  robots: { index: false, follow: false },
};

export default async function CampaignWebVersionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  const { token } = await params;
  if (!checkRateLimit("emailTracking", await headers()).allowed) notFound();
  const version = await loadCampaignWebVersion(db, token, AbortSignal.timeout(5_000));
  if (version === null) notFound();

  return (
    <main className="min-h-dvh bg-muted">
      <iframe
        title={version.campaignName}
        srcDoc={version.html}
        className="h-dvh w-full border-0 bg-white"
        referrerPolicy="no-referrer"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </main>
  );
}
