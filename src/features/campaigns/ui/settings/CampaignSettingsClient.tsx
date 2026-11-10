"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  addCampaignSenderAction,
  checkCampaignDomainAction,
  saveCampaignSettingsAction,
  setDefaultCampaignSenderAction,
} from "../../actions";
import type { DomainCheckResult } from "../../domainCheck";
import type { SenderView } from "../../senders";
import type { CampaignSettingsView } from "../../settings";

// 6.9's page sections: senders, postal address, consent, sending, domain check and the bounce
// mailbox status. Mutations go through CSRF-checked server actions; the page refreshes after one.

const TRANSPORT_LABEL: Record<CampaignSettingsView["transport"], string> = {
  marketing: "Marketing SMTP",
  system: "System SMTP",
  log: "Log only (no mail server)",
};

export function CampaignSettingsClient({
  settings,
  senders,
  verified,
}: {
  settings: CampaignSettingsView;
  senders: SenderView[];
  verified: boolean | null;
}): React.ReactNode {
  const router = useRouter();
  const [postalAddress, setPostalAddress] = useState(settings.postalAddress);
  const [requireDoubleOptIn, setRequireDoubleOptIn] = useState(settings.requireDoubleOptIn);
  const [consentLabel, setConsentLabel] = useState(settings.consentLabel);
  const [rate, setRate] = useState(String(settings.sendRatePerMinute));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [senderMessage, setSenderMessage] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("");
  const [checks, setChecks] = useState<DomainCheckResult | null>(null);

  async function save(): Promise<void> {
    setError(null);
    setSaved(false);
    const result = await saveCampaignSettingsAction(
      {
        postalAddress: postalAddress.trim() === "" ? null : postalAddress,
        requireDoubleOptIn,
        consentLabel: consentLabel.trim() === "" ? null : consentLabel,
        sendRatePerMinute: Number(rate),
      },
      readCsrfToken(),
    );
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function addSender(): Promise<void> {
    setError(null);
    const result = await addCampaignSenderAction({ fromName, fromEmail }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setAddOpen(false);
    setFromName("");
    setFromEmail("");
    setSenderMessage(
      result.value.verificationSent
        ? "Verification email sent. The sender stays pending until it is opened."
        : "Sender added, but the verification email could not be sent.",
    );
    router.refresh();
  }

  async function makeDefault(id: string): Promise<void> {
    setError(null);
    const result = await setDefaultCampaignSenderAction({ id }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.refresh();
  }

  async function runDomainCheck(): Promise<void> {
    setError(null);
    const result = await checkCampaignDomainAction(
      { domain, selector: selector.trim() === "" ? null : selector },
      readCsrfToken(),
    );
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setChecks(result.value);
  }

  return (
    <div className="space-y-5">
      {verified === true ? (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-link-record">
          Sender verified.
        </p>
      ) : verified === false ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That verification link is expired or already used.
        </p>
      ) : null}
      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Senders</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            Add sender
          </Button>
        </div>
        {senderMessage === null ? null : (
          <p className="text-sm text-muted-foreground">{senderMessage}</p>
        )}
        {senders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No senders yet. Add one and confirm its verification email before sending.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {senders.map((sender) => (
              <li key={sender.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium">{sender.fromName}</span>
                <span className="text-muted-foreground">{sender.fromEmail}</span>
                <Badge variant={sender.verified ? "success" : "secondary"}>
                  {sender.verified ? "Verified" : "Pending"}
                </Badge>
                {sender.isDefault ? <Badge variant="outline">Default</Badge> : null}
                {sender.verified && !sender.isDefault ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void makeDefault(sender.id)}
                  >
                    Make default
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Postal address</h2>
        <FormField
          label="Company address"
          htmlFor="campaign-postal-address"
          hint="Required before any campaign can send; it appears in every footer."
        >
          <Textarea
            id="campaign-postal-address"
            rows={3}
            value={postalAddress}
            onChange={(event) => setPostalAddress(event.target.value)}
          />
        </FormField>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Consent</h2>
        <label htmlFor="require-doi" className="flex items-start gap-2 text-sm">
          <Checkbox
            id="require-doi"
            checked={requireDoubleOptIn}
            onCheckedChange={setRequireDoubleOptIn}
            label="Require double opt-in for form sign-ups"
          />
          <span>Require double opt-in for form sign-ups</span>
        </label>
        <p className="text-sm text-muted-foreground">Double opt-in links expire after 30 days.</p>
        <FormField label="Default consent label" htmlFor="consent-label">
          <Input
            id="consent-label"
            value={consentLabel}
            maxLength={500}
            onChange={(event) => setConsentLabel(event.target.value)}
          />
        </FormField>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Sending</h2>
        <FormField
          label="Send rate per minute"
          htmlFor="send-rate"
          hint={`Maximum ${settings.maxRatePerMinute}.`}
        >
          <Input
            id="send-rate"
            type="number"
            min={1}
            max={settings.maxRatePerMinute}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </FormField>
        <p className="text-sm text-muted-foreground">Batch size: 50 (fixed by the server).</p>
        <p className="text-sm text-muted-foreground">
          Transport: {TRANSPORT_LABEL[settings.transport]}
          {settings.transportHost === null ? "" : ` (${settings.transportHost})`}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Domain check</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Domain" htmlFor="domain-check-domain">
            <Input
              id="domain-check-domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
            />
          </FormField>
          <FormField label="DKIM selector" htmlFor="domain-check-selector">
            <Input
              id="domain-check-selector"
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
              placeholder="mail"
            />
          </FormField>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={domain.trim() === ""}
          onClick={() => void runDomainCheck()}
        >
          Check
        </Button>
        {checks === null ? null : (
          <ul className="space-y-2 text-sm">
            {(["spf", "dkim", "dmarc"] as const).map((key) => (
              <li key={key} className="flex flex-wrap items-center gap-2">
                <Badge variant={checks[key].status === "pass" ? "success" : "secondary"}>
                  {checks[key].status}
                </Badge>
                <span className="font-medium">{key.toUpperCase()}</span>
                <span className="text-muted-foreground">{checks[key].detail}</span>
                {checks[key].fix === "" ? null : (
                  <span className="text-xs text-muted-foreground">{checks[key].fix}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Bounce mailbox</h2>
        {settings.bounceMailbox.configured ? (
          <p className="text-sm text-muted-foreground">
            Configured. Last run:{" "}
            {settings.bounceMailbox.lastRunAt === null
              ? "not yet"
              : new Date(settings.bounceMailbox.lastRunAt).toLocaleString()}
            . Last processed: {settings.bounceMailbox.lastProcessed ?? 0} report
            {(settings.bounceMailbox.lastProcessed ?? 0) === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not configured. Set CAMPAIGN_BOUNCE_IMAP_HOST, CAMPAIGN_BOUNCE_IMAP_PORT,
            CAMPAIGN_BOUNCE_IMAP_USER and CAMPAIGN_BOUNCE_IMAP_PASS to collect asynchronous bounces.
          </p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void save()}>
          Save settings
        </Button>
        {saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add a sender</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <FormField label="From name" htmlFor="sender-name" required>
              <Input
                id="sender-name"
                value={fromName}
                maxLength={120}
                onChange={(event) => setFromName(event.target.value)}
              />
            </FormField>
            <FormField label="From email" htmlFor="sender-email" required>
              <Input
                id="sender-email"
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
              />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={fromName.trim() === "" || fromEmail.trim() === ""}
              onClick={() => void addSender()}
            >
              Add and verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
