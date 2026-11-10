import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { db } from "@/db/client";
import {
  recordCampaignClick,
  resolveCampaignClickTarget,
} from "@/features/campaigns/tracking/events";
import { checkRateLimit } from "@/server/rateLimitGuard";

// GET /t/c/l/{token}/{n} (6.8). The destination is always the stored campaign_links template for
// this recipient, rendered with that recipient's merge values; the request supplies only the
// opaque token and a numeric index. An unknown token or index redirects to BASE_URL, never to a
// URL from the query string. Over the limiter the recording is skipped but the redirect stands.

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const INDEX = /^\d{1,6}$/;

function withNoIndex(response: Response): Response {
  response.headers.set("x-robots-tag", "noindex");
  response.headers.set("cache-control", "no-store");
  return response;
}

function redirect(target: string | null): Response {
  return withNoIndex(NextResponse.redirect(target ?? env.BASE_URL, 302));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; n: string }> },
): Promise<Response> {
  const recording = checkRateLimit("emailTracking", req.headers).allowed;
  let target: string | null = null;
  try {
    const { token, n } = await ctx.params;
    if (TOKEN.test(token) && INDEX.test(n)) {
      const linkIndex = Number.parseInt(n, 10);
      target = recording
        ? await recordCampaignClick(
            db,
            token,
            linkIndex,
            req.headers.get("user-agent"),
            AbortSignal.timeout(5_000),
          )
        : await resolveCampaignClickTarget(db, token, linkIndex, AbortSignal.timeout(5_000));
    }
  } catch {
    // Best effort: an unknown or failed lookup falls through to the safe fallback.
  }
  return redirect(target);
}
