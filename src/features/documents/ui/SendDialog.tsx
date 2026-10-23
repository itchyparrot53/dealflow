"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import { documentSendDraftAction, sendDocumentAction } from "@/features/documents/actions";
import type { DocKind, DocStatus } from "@/features/documents/transitions";
import { RichTextBody } from "@/features/email/composer/RichTextBody";
import { readCsrfToken } from "@/utils/csrfCookie";

const S = DOCUMENTS_STRINGS;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    kind: DocKind;
    status: DocStatus;
    number: string | null;
    customerEmail: string | null;
  };
  onSent: () => void;
}

function errorText(id: string, status: DocStatus): string {
  switch (id) {
    case ERROR_IDS.DOC_NO_CUSTOMER_EMAIL:
      return S.errors.noCustomerEmail;
    case ERROR_IDS.DOC_NO_MAILBOX:
      return S.errors.noMailbox;
    case ERROR_IDS.DOC_TRANSITION:
      return S.errors.transition(status);
    case ERROR_IDS.DOC_INPUT_INVALID:
      return S.errors.invalid;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.sendFailed;
  }
}

export function SendDialog({ open, onOpenChange, document, onSent }: Props): React.ReactNode {
  const [to, setTo] = useState(document.customerEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // The prefill is a preview of what the server will render anyway. Sending an untouched subject
  // would freeze the unnumbered draft copy instead of letting the issue step put the number in.
  const [prefilled, setPrefilled] = useState({ subject: "", message: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the resolved quote/invoice template when the dialog opens. The server still
  // renders the copy on send, so an untouched field and a cleared one behave the same.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void documentSendDraftAction(document.id).then((result) => {
      if (cancelled || !result.ok) return;
      setSubject(result.value.subject);
      setMessage(result.value.messageHtml);
      setPrefilled({ subject: result.value.subject, message: result.value.messageHtml });
    });
    return () => {
      cancelled = true;
    };
  }, [open, document.id]);

  async function send(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await sendDocumentAction(
      document.id,
      {
        ...(to.trim() === "" ? {} : { to: to.trim() }),
        ...(subject.trim() === "" || subject === prefilled.subject
          ? {}
          : { subject: subject.trim() }),
        ...(message.trim() === "" || message === prefilled.message
          ? {}
          : { message: message.trim() }),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id, document.status));
      return;
    }
    onSent();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="document-send-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{document.status === "draft" ? S.send : S.sendAgain}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <label className="block" htmlFor="document-send-to">
              <span className="mb-1.5 block text-sm font-medium">{S.to}</span>
              <Input
                id="document-send-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block" htmlFor="document-send-subject">
              <span className="mb-1.5 block text-sm font-medium">{S.subject}</span>
              <Input
                id="document-send-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={`${document.kind === "quote" ? "Quote" : "Invoice"} ${document.number ?? ""}`}
                disabled={pending}
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-medium">{S.message}</span>
              <RichTextBody
                html={message}
                onChange={setMessage}
                ariaLabel={S.message}
                frameClassName="rounded-md border bg-card"
              />
            </div>
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
          <Button type="button" size="sm" disabled={pending} onClick={() => void send()}>
            {pending ? S.sending : S.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
