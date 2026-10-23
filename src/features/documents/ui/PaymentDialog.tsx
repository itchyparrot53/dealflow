"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import { recordPaymentAction } from "@/features/documents/actions";
import type { DocStatus } from "@/features/documents/transitions";
import { readCsrfToken } from "@/utils/csrfCookie";

const S = DOCUMENTS_STRINGS;

const METHODS = [
  { value: "bank_transfer", label: S.methodBankTransfer },
  { value: "card", label: S.methodCard },
  { value: "cash", label: S.methodCash },
  { value: "other", label: S.methodOther },
] as const;

type Method = (typeof METHODS)[number]["value"];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: { id: string; outstanding: string; status: DocStatus };
  onRecorded: () => void;
}

function errorText(id: string, status: DocStatus): string {
  switch (id) {
    case ERROR_IDS.DOC_OVERPAYMENT:
      return S.errors.overpayment;
    case ERROR_IDS.DOC_TRANSITION:
      return S.errors.transition(status);
    case ERROR_IDS.DOC_INPUT_INVALID:
      return S.errors.invalid;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.recordFailed;
  }
}

export function PaymentDialog({
  open,
  onOpenChange,
  document,
  onRecorded,
}: Props): React.ReactNode {
  const [amount, setAmount] = useState(document.outstanding);
  const [paidOn, setPaidOn] = useState<string | null>(todayUtc());
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(): Promise<void> {
    if (paidOn === null) {
      setError(S.errors.invalid);
      return;
    }
    setPending(true);
    setError(null);
    const result = await recordPaymentAction(
      {
        documentId: document.id,
        amount: amount.trim(),
        paidOn,
        method,
        reference: reference.trim() === "" ? null : reference.trim(),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id, document.status));
      return;
    }
    onRecorded();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="document-payment-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{S.recordPayment}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <label className="block" htmlFor="document-payment-amount">
              <span className="mb-1.5 block text-sm font-medium">{S.amount}</span>
              <Input
                id="document-payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={pending}
              />
            </label>
            <div className="block">
              <span className="mb-1.5 block text-sm font-medium">{S.paidOn}</span>
              <DatePicker
                value={paidOn}
                onChange={setPaidOn}
                ariaLabel={S.paidOn}
                placeholder={S.paidOn}
              />
            </div>
            <div className="block">
              <span className="mb-1.5 block text-sm font-medium">{S.method}</span>
              <Select
                value={method}
                onChange={(value) => setMethod(value as Method)}
                options={METHODS.map((item) => ({ value: item.value, label: item.label }))}
                ariaLabel={S.method}
              />
            </div>
            <label className="block" htmlFor="document-payment-reference">
              <span className="mb-1.5 block text-sm font-medium">{S.reference}</span>
              <Input
                id="document-payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={pending}
              />
            </label>
          </div>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {S.cancel}
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => void record()}>
            {pending ? S.recording : S.record}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
