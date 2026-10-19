import type { NextResponse } from "next/server";
import { CSRF_COOKIE, mintCsrfToken } from "./csrf";
import { SESSION_COOKIE, sessionCookieOptions } from "./session";

// One place that turns a session id into the two cookies the app expects: the httpOnly bearer
// cookie and the double-submit CSRF token that client code reads. Both expire with the session.
export function applySessionCookies(res: NextResponse, sid: string, expiresAt: Date): void {
  res.cookies.set(SESSION_COOKIE, sid, { ...sessionCookieOptions(), expires: expiresAt });
  res.cookies.set(CSRF_COOKIE, mintCsrfToken(), {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
