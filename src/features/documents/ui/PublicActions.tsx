"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import type { DocStatus } from "../transitions";
import { longDate } from "./DocumentView";

const S = DOCUMENTS_STRINGS;

interface Props {
  publicId: string;
  status: DocStatus;
  expired: boolean;
  ownerName: string;
  acceptedName: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
}

function errorText(id: string | undefined, status: DocStatus): string {
  switch (id) {
    case ERROR_IDS.DOC_EXPIRED:
      return S.errors.expired;
    case ERROR_IDS.DOC_TRANSITION:
      return S.errors.transition(status);
    case ERROR_IDS.DOC_RATE_LIMITED:
      return S.errors.rateLimited;
    case undefined:
      return S.errors.invalid;
    default:
      return S.errors.invalid;
  }
}

async function post(
  publicId: string,
  action: "accept" | "decline",
  body: unknown,
): Promise<{ ok: true } | { ok: false; id: string | undefined }> {
  const response = await fetch(`/api/public/documents/${publicId}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) return { ok: true };
  const data: unknown = await response.json().catch(() => null);
  const id =
    typeof data === "object" && data !== null && "error" in data ? String(data.error) : undefined;
  return { ok: false, id };
}

// The print-to-PDF path is the browser's own: no server PDF engine.
export function PrintButton({ label }: { label: string }): React.ReactNode {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-print-hide
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}

export function PublicActions({
  publicId,
  status,
  expired,
  ownerName,
  acceptedName,
  acceptedAt,
  declinedAt,
  declineReason,
}: Props): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await post(publicId, "accept", { name: name.trim(), agree: true });
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.id, status));
      return;
    }
    router.refresh();
  }

  async function decline(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await post(publicId, "decline", {
      reason: reason.trim() === "" ? null : reason.trim(),
    });
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.id, status));
      return;
    }
    router.refresh();
  }

  if (status === "accepted") {
    return (
      <section className="rounded-lg border border-success/40 bg-success/15 p-4 text-sm">
        <p className="font-medium">
          Accepted by {acceptedName ?? ""}
          {acceptedAt !== null ? ` on ${longDate(acceptedAt.slice(0, 10))}` : ""}
        </p>
      </section>
    );
  }

  if (status === "declined") {
    return (
      <section className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">This quote was declined</p>
        {declineReason !== null && <p className="mt-1 text-muted-foreground">{declineReason}</p>}
        {declinedAt !== null && (
          <p className="mt-1 text-muted-foreground">
            Declined on {longDate(declinedAt.slice(0, 10))}
          </p>
        )}
      </section>
    );
  }

  if (expired) {
    return (
      <section className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">
          This quote has expired.{ownerName === "" ? "" : ` Contact ${ownerName}.`}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4" data-print-hide>
      <p className="text-sm font-medium">Type your full name to accept</p>
      <div className="mt-3 space-y-3">
        <Input
          data-testid="public-accept-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Your full name"
          disabled={pending}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="public-accept-checkbox"
            testId="public-accept-checkbox"
            label="I accept this quote"
            checked={agreed}
            onCheckedChange={setAgreed}
            disabled={pending}
          />
          <label htmlFor="public-accept-checkbox" className="text-sm">
            I accept this quote
          </label>
        </div>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            data-testid="public-accept"
            size="sm"
            disabled={pending || !agreed || name.trim() === ""}
            onClick={() => void accept()}
          >
            Accept quote
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="public-decline"
            disabled={pending}
            onClick={() => setDeclineOpen((current) => !current)}
          >
            Decline
          </Button>
        </div>
        {declineOpen && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional: why are you declining?"
              aria-label="Reason for declining"
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void decline()}
            >
              Send decline
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
