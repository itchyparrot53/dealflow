import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { consumeAuthToken } from "@/features/auth/authTokens";
import { markEmailVerified } from "@/features/auth/credentials";
import { loginReturnTarget } from "@/features/auth/loginReturn";
import { isSameOriginPost } from "@/features/auth/originCheck";
import { createSession } from "@/features/auth/session";
import { applySessionCookies } from "@/features/auth/sessionCookies";
import { checkRateLimit } from "@/server/rateLimitGuard";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  next: z.string().max(4_096).optional(),
});

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.BASE_URL), 303);
}

// POST /auth/magic/verify: spends the single-use link. The GET page only peeks, so a mail scanner
// prefetching the link cannot sign the user in or burn the token.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginPost(req.headers)) return new NextResponse("Forbidden", { status: 403 });

  const limit = checkRateLimit("authTokenVerify", req.headers);
  if (!limit.allowed) return redirect("/login?error=rate_limited&method=link");

  const form = await req.formData();
  const parsed = bodySchema.safeParse({
    token: form.get("token") ?? "",
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) return redirect("/login?error=link_expired&method=link");

  const signal = AbortSignal.timeout(10_000);
  const consumed = await consumeAuthToken(db, parsed.data.token, ["magic_link"], signal);
  if (!consumed.ok) return redirect("/login?error=link_expired&method=link");

  await markEmailVerified(db, consumed.value.userId, signal);
  const session = await createSession(db, consumed.value.userId, signal);
  if (!session.ok) return redirect("/login?error=link_expired&method=link");

  const res = redirect(loginReturnTarget(parsed.data.next));
  applySessionCookies(res, session.value.sid, session.value.expiresAt);
  return res;
}
