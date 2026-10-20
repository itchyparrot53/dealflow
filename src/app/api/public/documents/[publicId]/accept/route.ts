import { type NextRequest, NextResponse } from "next/server";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { isSameOriginPost } from "@/features/auth/originCheck";
import { acceptQuote, clientIp, publicHttpStatus } from "@/features/documents/publicDocuments";
import { checkPublicRateLimit } from "@/features/documents/publicRateLimit";

// Public quote acceptance. No session: origin check, then rate limit, then a
// 16 KB body, then the service. The body is only a name, the agreement flag and
// the IP the service records.

const MAX_BODY_BYTES = 16 * 1024;

function fail(errorId: string): NextResponse {
  return NextResponse.json({ error: errorId }, { status: publicHttpStatus(errorId) });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await ctx.params;
  if (!isSameOriginPost(req.headers)) {
    return NextResponse.json({ error: ERROR_IDS.AUTH_ORIGIN_REJECTED }, { status: 403 });
  }
  const ip = clientIp(req.headers);
  const limited = checkPublicRateLimit(ip, publicId);
  if (!limited.ok) return fail(limited.error.id);

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return fail(ERROR_IDS.DOC_INPUT_INVALID);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(ERROR_IDS.DOC_INPUT_INVALID);
  }
  const raw = typeof body === "object" && body !== null ? { ...body, ip } : { ip };
  const result = await acceptQuote(db, publicId, raw, AbortSignal.timeout(5000));
  if (!result.ok) return fail(result.error.id);
  return NextResponse.json({ status: result.value.status });
}
