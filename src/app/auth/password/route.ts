import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { authMethods } from "@/features/auth/authMethods";
import { loginReturnTarget } from "@/features/auth/loginReturn";
import { isSameOriginPost } from "@/features/auth/originCheck";
import { passwordLogin } from "@/features/auth/passwordLogin";
import { createSession } from "@/features/auth/session";
import { recordSessionAuth } from "@/features/auth/sessionAuth";
import { applySessionCookies } from "@/features/auth/sessionCookies";
import { checkRateLimit } from "@/server/rateLimitGuard";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().max(254),
  password: z.string().max(1024),
  next: z.string().max(4_096).optional(),
});

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.BASE_URL), 303);
}

// POST /auth/password: the email + password sign-in form. Every failure answers with the same
// redirect so the response never reveals whether the address exists.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authMethods().password) return new NextResponse(null, { status: 404 });
  if (!isSameOriginPost(req.headers)) return new NextResponse("Forbidden", { status: 403 });

  const limit = checkRateLimit("authPassword", req.headers);
  if (!limit.allowed) return redirect("/login?error=rate_limited&method=password");

  const form = await req.formData();
  const parsed = bodySchema.safeParse({
    email: form.get("email") ?? "",
    password: form.get("password") ?? "",
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) return redirect("/login?error=invalid_credentials&method=password");

  const signal = AbortSignal.timeout(10_000);
  const result = await passwordLogin(
    db,
    { email: parsed.data.email, password: parsed.data.password },
    signal,
  );
  if (!result.ok) return redirect("/login?error=invalid_credentials&method=password");

  const session = await createSession(db, result.value.userId, signal);
  if (!session.ok) return redirect("/login?error=invalid_credentials&method=password");
  await recordSessionAuth(db, session.value.sessionId, "password", signal);

  const res = redirect(loginReturnTarget(parsed.data.next));
  applySessionCookies(res, session.value.sid, session.value.expiresAt);
  return res;
}
