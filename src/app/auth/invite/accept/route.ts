import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { acceptInvite } from "@/features/auth/invites";
import { isSameOriginPost } from "@/features/auth/originCheck";
import { checkPasswordPolicy } from "@/features/auth/password";
import { createSession } from "@/features/auth/session";
import { recordSessionAuth } from "@/features/auth/sessionAuth";
import { applySessionCookies } from "@/features/auth/sessionCookies";
import { checkRateLimit } from "@/server/rateLimitGuard";

export const runtime = "nodejs";

const NAME_MAX = 120;

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.BASE_URL), 303);
}

function backToForm(token: string, error: string): NextResponse {
  return redirect(`/login/invite?token=${encodeURIComponent(token)}&error=${error}`);
}

// POST /auth/invite/accept: sets the invited user's name and password from a single-use link.
// Validation runs BEFORE the token is consumed so a typo does not burn the invite.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginPost(req.headers)) return new NextResponse("Forbidden", { status: 403 });

  const limit = checkRateLimit("authTokenVerify", req.headers);
  if (!limit.allowed) return redirect("/login?error=rate_limited");

  const form = await req.formData();
  // formData values can be Files, so narrow to strings instead of stringifying. A File in any of
  // these fields is a malformed form and the empty string fails the same checks below.
  const field = (key: string): string => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const token = field("token");
  const name = field("name").trim();
  const password = field("password");
  const confirm = field("confirm");

  if (token === "") return redirect("/login?error=link_expired");
  if (name === "" || name.length > NAME_MAX) return backToForm(token, "name_missing");
  if (!checkPasswordPolicy(password).ok) return backToForm(token, "password_short");
  if (password !== confirm) return backToForm(token, "password_mismatch");

  const signal = AbortSignal.timeout(10_000);
  const accepted = await acceptInvite(db, { token, name, password }, signal);
  if (!accepted.ok) return redirect("/login?error=link_expired");

  const session = await createSession(db, accepted.value.userId, signal);
  if (!session.ok) return redirect("/login?error=link_expired");
  await recordSessionAuth(db, session.value.sessionId, "invite", signal);

  const res = redirect("/pipeline");
  applySessionCookies(res, session.value.sid, session.value.expiresAt);
  return res;
}
