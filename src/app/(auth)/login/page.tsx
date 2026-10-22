import type React from "react";
import { AUTH_STRINGS } from "@/constants/authStrings";
import { authMethods } from "@/features/auth/authMethods";
import { safeLoginReturnPath } from "@/features/auth/loginReturn";
import { BrandLogo } from "@/features/branding/BrandLogo";
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
    <main
      data-theme-lock="light"
      className="flex min-h-screen flex-col items-center justify-center bg-canvas-subtle p-6"
    >
      <div className="mb-6 flex w-full max-w-[400px] justify-center">
        <BrandLogo height={32} />
      </div>
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-8">
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
