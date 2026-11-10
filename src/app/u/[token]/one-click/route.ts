import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { applyUnsubscribe } from "@/features/marketing/unsubscribe";
import { clientIp } from "@/features/net/clientIp";
import { checkRateLimit } from "@/server/rateLimitGuard";

// RFC 8058 one-click unsubscribe: POST /u/{token}/one-click with the exact body
// `List-Unsubscribe=One-Click`. It is a child segment because Next.js refuses a route.ts and a
// page.tsx at the same segment, and the preference page keeps the short /u/{token} link.
// The token is the credential, so this route is the one deliberate CSRF exemption in the feature;
// it never trusts a person or campaign id from the request.
//
// Rate limiting is fail-open like the tracking pixel: a real recipient must be able to unsubscribe
// even while someone else is flooding the endpoint. The write is a single idempotent transition.

const NOINDEX = { "x-robots-tag": "noindex" } as const;
const ONE_CLICK_BODY = "List-Unsubscribe=One-Click";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;
  checkRateLimit("emailTracking", req.headers);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return new NextResponse(null, { status: 400, headers: NOINDEX });
  }
  const body = await req.text();
  if (body.trim() !== ONE_CLICK_BODY) {
    return new NextResponse(null, { status: 400, headers: NOINDEX });
  }

  await applyUnsubscribe(
    db,
    token,
    {
      source: "one_click",
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    },
    AbortSignal.timeout(10_000),
  ).catch(() => undefined);

  // 200 whether the token was known or not: an unknown token must not be distinguishable, and the
  // mailbox provider only needs to know the request was handled.
  return new NextResponse(null, { status: 200, headers: NOINDEX });
}
