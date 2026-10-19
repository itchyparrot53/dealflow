import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { authMethods } from "@/features/auth/authMethods";
import { loginReturnTarget } from "@/features/auth/loginReturn";
import { requestMagicLink } from "@/features/auth/magicLink";
import { isSameOriginPost } from "@/features/auth/originCheck";
import { getSystemMailer } from "@/features/mailer/systemMailer";
import { checkRateLimit } from "@/server/rateLimitGuard";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().max(254),
  next: z.string().max(4_096).optional(),
});

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.BASE_URL), 303);
}

// POST /auth/magic-link: always answers "sent" whether or not the address exists, so the form
// cannot be used to enumerate accounts. Delivery problems are logged for the operator only.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authMethods().magicLink) return new NextResponse(null, { status: 404 });
  if (!isSameOriginPost(req.headers)) return new NextResponse("Forbidden", { status: 403 });

  const limit = checkRateLimit("authMagicRequest", req.headers);
  if (!limit.allowed) return redirect("/login?error=rate_limited&method=link");

  const form = await req.formData();
  const parsed = bodySchema.safeParse({
    email: form.get("email") ?? "",
    next: form.get("next") ?? undefined,
  });
  if (parsed.success) {
    const signal = AbortSignal.timeout(10_000);
    const result = await requestMagicLink(
      db,
      { email: parsed.data.email, next: loginReturnTarget(parsed.data.next) },
      {
        mailer: getSystemMailer(),
        baseUrl: env.BASE_URL,
        seedAdminEmail: env.SEED_ADMIN_EMAIL,
      },
      signal,
    );
    if (!result.ok) {
      console.error(`[auth/magic-link] ${result.error.id}: ${result.error.message}`);
    }
  }
  return redirect("/login?sent=1&method=link");
}
