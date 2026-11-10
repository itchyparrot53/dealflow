import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { verifySenderToken } from "@/features/campaigns/senders";

// Sender verification link (6.9). The token is the credential, so a GET is acceptable here: a mail
// scanner that prefetches it only completes a verification the team already requested, and unlike
// double opt-in it does not subscribe anyone or change consent.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;
  const result = await verifySenderToken(db, token, AbortSignal.timeout(10_000)).catch(() => null);
  const target = new URL(
    result !== null && result.ok
      ? "/settings/campaigns?verified=1"
      : "/settings/campaigns?verified=0",
    req.url,
  );
  return NextResponse.redirect(target, {
    headers: { "x-robots-tag": "noindex" },
  });
}
