import type { Metadata } from "next";
import type { ReactNode } from "react";
import { db } from "@/db/client";
import { loadDoubleOptInContext } from "@/features/marketing/doubleOptIn";
import { confirmSubscriptionAction } from "./actions";

// Public page: no session, the token is the whole credential. Lives outside the (app) group like
// /d, /f and /book, and is never indexed.

export const metadata: Metadata = {
  title: "Confirm subscription",
  robots: { index: false, follow: false },
};

export default async function ConfirmSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}): Promise<ReactNode> {
  const { token } = await params;
  const { state } = await searchParams;
  const context = await loadDoubleOptInContext(db, token, AbortSignal.timeout(5000));

  const confirmed = state === "subscribed";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-muted-foreground">{context.companyName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {confirmed
            ? "You're subscribed"
            : context.valid
              ? `Confirm your subscription to ${context.companyName}`
              : "This link has expired"}
        </h1>
      </div>

      {confirmed ? (
        <p className="text-center text-sm text-muted-foreground">
          We'll send you updates from {context.companyName}. Every email has an unsubscribe link.
        </p>
      ) : context.valid ? (
        <>
          <p className="text-center text-sm text-muted-foreground">
            We'll only email {context.emailMasked} after you confirm. You can unsubscribe at any
            time.
          </p>
          <form action={confirmSubscriptionAction}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Confirm
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            If you didn't ask for this, ignore this page and you won't hear from us.
          </p>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          This confirmation link is no longer valid. Ask {context.companyName} to send a new one.
        </p>
      )}
    </main>
  );
}
