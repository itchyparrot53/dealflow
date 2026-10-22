import Link from "next/link";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { AUTH_STRINGS } from "@/constants/authStrings";
import { db } from "@/db/client";
import { peekAuthToken } from "@/features/auth/authTokens";
import { safeLoginReturnPath } from "@/features/auth/loginReturn";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// GET /login/magic: the confirm card between clicking the emailed link and spending it. It only
// peeks at the token, so a mail scanner that prefetches the URL cannot use or burn the link.
export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<React.ReactNode> {
  const params = await searchParams;
  const token = first(params.token);
  const next = safeLoginReturnPath(first(params.next));
  const peek =
    token === null
      ? null
      : await peekAuthToken(db, token, ["magic_link"], AbortSignal.timeout(10_000));

  return (
    <main
      data-theme-lock="light"
      className="flex min-h-screen items-center justify-center bg-canvas-subtle p-6"
    >
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-8">
        {peek !== null && peek.ok ? (
          <>
            <h1 className="text-balance text-title">{AUTH_STRINGS.signInAs(peek.value.email)}</h1>
            <form method="post" action="/auth/magic/verify" className="mt-6">
              <input type="hidden" name="token" value={token ?? ""} />
              <input type="hidden" name="next" value={next} />
              <Button type="submit" className="w-full">
                {AUTH_STRINGS.continue}
              </Button>
            </form>
          </>
        ) : (
          <div data-testid="magic-invalid" className="space-y-3">
            <p className="text-pretty text-sm text-muted-foreground">{AUTH_STRINGS.expired}</p>
            <Link href="/login" className="text-sm underline underline-offset-2">
              {AUTH_STRINGS.backToSignIn}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
