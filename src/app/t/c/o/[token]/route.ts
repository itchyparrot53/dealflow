import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { recordCampaignOpen } from "@/features/campaigns/tracking/events";
import { checkRateLimit } from "@/server/rateLimitGuard";

// GET /t/c/o/{token}.gif (6.8). Public pixel. It follows the one-to-one /t/open route's rule:
// return the GIF no matter what, and shed only the recording when the limiter is exhausted, so a
// real inbox never shows a broken image because someone else was abusive.

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const TOKEN_FILE = /^([A-Za-z0-9_-]{16,64})\.gif$/;

function pixel(): Response {
  return new Response(new Uint8Array(GIF), {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, private",
      pragma: "no-cache",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const recording = checkRateLimit("emailTracking", req.headers).allowed;
  if (recording) {
    try {
      const { token } = await ctx.params;
      const match = TOKEN_FILE.exec(token);
      if (match?.[1] !== undefined) {
        await recordCampaignOpen(
          db,
          match[1],
          req.headers.get("user-agent"),
          AbortSignal.timeout(5_000),
        );
      }
    } catch {
      // Fail-open: a tracking failure still returns the pixel.
    }
  }
  return pixel();
}
