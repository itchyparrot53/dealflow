import type React from "react";
import { AUTH_STRINGS } from "@/constants/authStrings";
import { authMethods } from "@/features/auth/authMethods";
import { safeLoginReturnPath } from "@/features/auth/loginReturn";
import { LoginPanel } from "./LoginPanel";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<React.ReactNode> {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[400px] rounded-lg border bg-background p-6">
        <h1 className="text-balance text-xl font-semibold">{AUTH_STRINGS.signInTitle}</h1>
        <LoginPanel
          methods={authMethods()}
          error={first(params.error)}
          sent={first(params.sent) === "1"}
          method={first(params.method)}
          next={safeLoginReturnPath(first(params.next))}
        />
      </div>
    </main>
  );
}
