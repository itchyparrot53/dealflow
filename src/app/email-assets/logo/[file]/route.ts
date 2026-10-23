import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { getEmailLogo } from "@/features/email-design/design";
import { checkRateLimit } from "@/server/rateLimitGuard";

// GET /email-assets/logo/{hash}.{png|jpg} (PLAN-PART13 6.3). Public by construction: it lives
// outside the (app) group like /d, /f and /book, and there is no middleware allow-list in this
// codebase. It serves only the stored bytes for the exact hash and its real extension.
//
// Fail-open on the rate limit, like the tracking pixel: an email logo must never render broken
// because someone else was abusive. Over the limit we still serve the stored bytes.

const SIGNAL_MS = 5000;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string }> },
): Promise<Response> {
  checkRateLimit("emailTracking", req.headers);
  const { file } = await ctx.params;
  const match = /^([0-9a-f]{16})\.(png|jpg)$/.exec(file);
  if (match === null) return new Response(null, { status: 404 });
  const [, hash, ext] = match;
  if (hash === undefined || (ext !== "png" && ext !== "jpg")) {
    return new Response(null, { status: 404 });
  }
  const signal = AbortSignal.timeout(SIGNAL_MS);
  const logo = await getEmailLogo(db, hash, ext, signal).catch(() => null);
  if (logo === null) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "content-type": logo.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
