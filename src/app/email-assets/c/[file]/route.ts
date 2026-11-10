import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { getCampaignAssetBytes } from "@/features/campaigns/assets";
import { checkRateLimit } from "@/server/rateLimitGuard";

// GET /email-assets/c/{id}.{png|jpg|gif} (6.5). Public by construction: it lives outside the (app)
// group like /d, /f and /book. Only the stored bytes for an existing id and its real extension are
// served, so the route cannot be used to probe for rows or to serve an arbitrary object key.
//
// Fail-open on the rate limit, like the tracking pixel: a campaign image in a real inbox must never
// render broken because someone else was abusive.

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|gif)$/;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string }> },
): Promise<Response> {
  checkRateLimit("emailTracking", req.headers);
  const { file } = await ctx.params;
  const match = FILE.exec(file);
  if (match === null) return new Response(null, { status: 404 });
  const [, id, ext] = match;
  if (id === undefined || ext === undefined) return new Response(null, { status: 404 });

  const asset = await getCampaignAssetBytes(
    db,
    id,
    ext,
    AbortSignal.timeout(5_000),
  ).catch(() => null);
  if (asset === null) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "content-type": asset.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-robots-tag": "noindex",
    },
  });
}
