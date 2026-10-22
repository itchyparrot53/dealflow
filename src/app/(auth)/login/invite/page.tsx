import Link from "next/link";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { AUTH_STRINGS } from "@/constants/authStrings";
import { db } from "@/db/client";
import { peekAuthToken } from "@/features/auth/authTokens";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// GET /login/invite: set a name and password from an invite (or first-admin setup) link. Like the
// magic-link card it only peeks at the token; the POST in /auth/invite/accept spends it.
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<React.ReactNode> {
  const params = await searchParams;
  const token = first(params.token);
  const errorCode = first(params.error);
  const errorText = errorCode === null ? undefined : AUTH_STRINGS.inviteErrors[errorCode];
  const peek =
    token === null
      ? null
      : await peekAuthToken(db, token, ["invite", "admin_setup"], AbortSignal.timeout(10_000));

  return (
    <main
      data-theme-lock="light"
      className="flex min-h-screen items-center justify-center bg-canvas-subtle p-6"
    >
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-8">
        {peek !== null && peek.ok ? (
          <>
            <h1 className="text-balance text-title">{AUTH_STRINGS.setPasswordTitle}</h1>
            {errorText !== undefined && (
              <p data-testid="invite-error" className="mt-3 text-sm text-destructive">
                {errorText}
              </p>
            )}
            <form method="post" action="/auth/invite/accept" className="mt-6 space-y-3">
              <input type="hidden" name="token" value={token ?? ""} />
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">{AUTH_STRINGS.nameLabel}</Label>
                <Input
                  id="invite-name"
                  name="name"
                  defaultValue={peek.value.name === peek.value.email ? "" : peek.value.name}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-password">{AUTH_STRINGS.newPasswordLabel}</Label>
                <Input
                  id="invite-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-confirm">{AUTH_STRINGS.confirmPasswordLabel}</Label>
                <Input
                  id="invite-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {AUTH_STRINGS.setPasswordAndSignIn}
              </Button>
            </form>
          </>
        ) : (
          <div data-testid="invite-invalid" className="space-y-3">
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
