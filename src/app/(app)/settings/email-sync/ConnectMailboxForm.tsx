"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { connectImapMailboxAction } from "@/features/mail/connect/actions";
import { readCsrfToken } from "@/utils/csrfCookie";
import { EMAIL_SYNC_STRINGS } from "./strings";

const S = EMAIL_SYNC_STRINGS;
const PROVIDERS = [
  { value: "purelymail", label: S.providerPurelymail },
  { value: "custom", label: S.providerCustom },
];

interface Props {
  initial?: { emailAddress?: string; imapHost?: string | null };
  googleEnabled: boolean;
  onConnected: () => void;
  onGmail: () => void;
}

// Connect or update an IMAP/SMTP mailbox with an app password. The server tests both servers
// before storing anything, so a wrong password leaves the current connection untouched.
export function ConnectMailboxForm({ initial, googleEnabled, onConnected, onGmail }: Props) {
  const id = useId();
  const [emailAddress, setEmailAddress] = useState(initial?.emailAddress ?? "");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState<"purelymail" | "custom">(
    initial?.imapHost !== undefined &&
      initial.imapHost !== null &&
      initial.imapHost !== "imap.purelymail.com"
      ? "custom"
      : "purelymail",
  );
  const [imapHost, setImapHost] = useState(initial?.imapHost ?? "");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (emailAddress.trim() === "" || password === "") {
      setError(S.missingFields);
      return;
    }
    const trimmedUsername = username.trim();
    const raw =
      provider === "custom"
        ? {
            emailAddress: emailAddress.trim(),
            password,
            preset: "custom",
            imapHost: imapHost.trim(),
            imapPort: Number(imapPort),
            imapSecure,
            smtpHost: smtpHost.trim(),
            smtpPort: Number(smtpPort),
            smtpSecure,
            ...(trimmedUsername === "" ? {} : { username: trimmedUsername }),
          }
        : { emailAddress: emailAddress.trim(), password, preset: "purelymail" };

    setPending(true);
    try {
      const result = await connectImapMailboxAction(raw, readCsrfToken());
      if (!result.ok) {
        setError(S.connectErrors[result.error.id] ?? S.actionError);
        return;
      }
      onConnected();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      data-testid="connect-mailbox-form"
      onSubmit={(event) => void submit(event)}
      className="space-y-4 rounded-md border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">{S.connectTitle}</h3>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-email`}>{S.emailLabel}</Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          required
          value={emailAddress}
          onChange={(event) => setEmailAddress(event.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-password`}>{S.passwordLabel}</Label>
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">{S.passwordHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-provider`}>{S.providerLabel}</Label>
        <Select
          ariaLabel={S.providerLabel}
          value={provider}
          onChange={(value) => setProvider(value === "custom" ? "custom" : "purelymail")}
          options={PROVIDERS}
          disabled={pending}
        />
      </div>

      {provider === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-imap-host`}>{S.imapHostLabel}</Label>
            <Input
              id={`${id}-imap-host`}
              value={imapHost}
              onChange={(event) => setImapHost(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-imap-port`}>{S.imapPortLabel}</Label>
            <Input
              id={`${id}-imap-port`}
              inputMode="numeric"
              value={imapPort}
              onChange={(event) => setImapPort(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-smtp-host`}>{S.smtpHostLabel}</Label>
            <Input
              id={`${id}-smtp-host`}
              value={smtpHost}
              onChange={(event) => setSmtpHost(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-smtp-port`}>{S.smtpPortLabel}</Label>
            <Input
              id={`${id}-smtp-port`}
              inputMode="numeric"
              value={smtpPort}
              onChange={(event) => setSmtpPort(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-imap-tls`}>{S.imapTlsLabel}</Label>
            <Switch
              id={`${id}-imap-tls`}
              label={S.imapTlsLabel}
              checked={imapSecure}
              onCheckedChange={setImapSecure}
              disabled={pending}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-smtp-tls`}>{S.smtpTlsLabel}</Label>
            <Switch
              id={`${id}-smtp-tls`}
              label={S.smtpTlsLabel}
              checked={smtpSecure}
              onCheckedChange={setSmtpSecure}
              disabled={pending}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor={`${id}-username`}>{S.usernameLabel}</Label>
            <Input
              id={`${id}-username`}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={pending}
            />
          </div>
        </div>
      )}

      {error !== null && (
        <p data-testid="connect-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? S.testingConnection : S.testAndConnect}
        </Button>
        {googleEnabled && (
          <Button type="button" variant="outline" disabled={pending} onClick={onGmail}>
            {S.connectGmailInstead}
          </Button>
        )}
      </div>
    </form>
  );
}
