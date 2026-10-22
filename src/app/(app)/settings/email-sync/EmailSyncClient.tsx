"use client";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { connectGmailStart, disconnectMailboxAction } from "@/features/email/actions";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsCardFooter,
  SettingsCardHeader,
} from "../SettingsSurface";
import { ConnectMailboxForm } from "./ConnectMailboxForm";
import { mailboxDisplayHealth, mailboxDotClass, mailboxStatusLabel } from "./statusLabel";
import { EMAIL_SYNC_STRINGS } from "./strings";

const S = EMAIL_SYNC_STRINGS;

export interface MailboxView {
  id: string;
  emailAddress: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAtIso: string | null;
  lastErrorId: string | null;
  provider: "imap" | "gmail";
  imapHost: string | null;
}

function formatSync(iso: string | null): string {
  if (iso === null) return S.neverSynced;
  return S.lastSynced(new Date(iso).toLocaleString());
}

export function EmailSyncClient({
  mailbox,
  googleEnabled,
}: {
  mailbox: MailboxView | null;
  googleEnabled: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is the browser's, not the request's: rendering a stall from the server time would disagree with the tab a minute later
  useEffect(() => setNow(new Date()), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const connected = mailbox !== null && mailbox.status === "connected";
  const health = mailboxDisplayHealth(mailbox, now);
  // A fresh, disconnected or failing mailbox shows the connect form; a connected one shows the
  // summary until "Update password" reopens the form prefilled.
  const showForm = !connected || editing;

  // Connect Gmail: the server mints the consent URL (and the single-use OAuth state cookie) and
  // the callback rebinds this user's account row.
  async function startConnect(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const { url } = await connectGmailStart();
      window.location.href = url;
    } catch {
      setPending(false);
      setError(S.actionError);
    }
  }

  async function disconnect(): Promise<void> {
    if (mailbox === null) return;
    setPending(true);
    setError(null);
    const r = await disconnectMailboxAction(readCsrfToken(), { accountId: mailbox.id });
    setPending(false);
    if (r.ok) {
      router.refresh();
    } else {
      setError(S.actionError);
    }
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        icon={<Mail className="size-4" aria-hidden="true" />}
        title="Mailbox connection"
        description="Connect one mailbox to sync messages and activity."
      />
      <SettingsCardBody>
        <div
          data-testid="mailbox-status"
          data-status={mailbox?.status ?? "none"}
          data-provider={mailbox?.provider ?? "none"}
          className="mb-1 flex items-center gap-2"
        >
          <span
            data-health={health}
            className={`inline-block h-2 w-2 rounded-full ${mailboxDotClass(health)}`}
          />
          <span className="text-sm font-medium">{mailboxStatusLabel(mailbox, now)}</span>
        </div>
        {mailbox !== null ? (
          <>
            <p className="text-sm text-muted-foreground">{S.connectedAs(mailbox.emailAddress)}</p>
            <p className="text-sm text-muted-foreground">
              {mailbox.provider === "imap"
                ? S.providerImap(mailbox.imapHost ?? "")
                : S.providerGmail}
            </p>
            <p className="text-sm text-muted-foreground">{formatSync(mailbox.lastSyncAtIso)}</p>
            {health === "stalled" ? (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
                {S.stalledHint}
              </p>
            ) : null}
            {mailbox.lastErrorId !== null ? (
              <p className="text-sm text-destructive">
                {S.lastErrorLabel}: {mailbox.lastErrorId}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{S.notConnected}</p>
        )}

        {showForm && (
          <div className="mt-4">
            <ConnectMailboxForm
              initial={
                mailbox === null
                  ? undefined
                  : {
                      emailAddress: mailbox.emailAddress,
                      imapHost: mailbox.imapHost,
                    }
              }
              googleEnabled={googleEnabled}
              onConnected={() => {
                setEditing(false);
                router.refresh();
              }}
              onGmail={() => void startConnect()}
            />
          </div>
        )}
      </SettingsCardBody>

      <SettingsCardFooter>
        {error !== null ? <span className="mr-auto text-sm text-destructive">{error}</span> : null}
        {connected && mailbox.provider === "imap" && !editing ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            {S.updatePassword}
          </Button>
        ) : null}
        {connected ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void disconnect()}
          >
            {pending ? S.disconnecting : S.disconnect}
          </Button>
        ) : null}
      </SettingsCardFooter>
    </SettingsCard>
  );
}
