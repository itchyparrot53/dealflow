import type { Metadata } from "next";
import type { ReactNode } from "react";
import { db } from "@/db/client";
import { loadUnsubscribeContext } from "@/features/marketing/unsubscribe";
import { resubscribeAction, unsubscribeAction } from "./actions";

// Public preference page behind the mandatory footer link. The token is the credential; there is
// no session and the page never mutates on GET.

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}): Promise<ReactNode> {
  const { token } = await params;
  const { state } = await searchParams;
  const context = await loadUnsubscribeContext(db, token, AbortSignal.timeout(5000));

  if (context === null || !context.valid) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <h1 className="text-title text-center">This link has expired</h1>
        <p className="text-center text-sm text-muted-foreground">
          This unsubscribe link is no longer valid. Use the link in a more recent email.
        </p>
      </main>
    );
  }

  const alreadyOut = context.status === "unsubscribed" || context.status === "bounced";
  const stateUnsubscribed = state === "unsubscribed";
  const statePending = state === "pending";
  const stateLimited = state === "limited";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-muted-foreground">{context.companyName}</p>
        <h1 className="text-title">
          {stateUnsubscribed
            ? "You're unsubscribed"
            : alreadyOut
              ? "You're unsubscribed"
              : `Unsubscribe ${context.emailMasked}?`}
        </h1>
      </div>

      {statePending ? (
        <p className="text-center text-sm text-muted-foreground">
          Check {context.emailMasked} for a confirmation link. You are subscribed again once you
          click it.
        </p>
      ) : stateLimited ? (
        <p className="text-center text-sm text-muted-foreground">
          A confirmation email was sent recently. Check your inbox, or try again tomorrow.
        </p>
      ) : stateUnsubscribed || alreadyOut ? (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {context.emailMasked} won't receive marketing email from {context.companyName}.
          </p>
          <form action={resubscribeAction}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Resubscribe
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {context.campaignName === null
              ? `You are subscribed to updates from ${context.companyName}.`
              : `You are subscribed to ${context.campaignName} from ${context.companyName}.`}
          </p>
          <form action={unsubscribeAction}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Unsubscribe
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            You can also change your mind later with the unsubscribe link in any email.
          </p>
        </>
      )}
    </main>
  );
}
