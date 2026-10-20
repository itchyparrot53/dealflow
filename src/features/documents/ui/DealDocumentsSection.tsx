"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/Select";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import { CollapsibleSection } from "@/features/deal-workspace/CollapsibleSection";
import { createDocumentAction } from "@/features/documents/actions";
import type { DocKind, DocStatus } from "@/features/documents/transitions";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { longDate } from "./DocumentView";

const S = DOCUMENTS_STRINGS;

const STATUS_LABEL: Record<DocStatus, string> = {
  draft: S.statusDraft,
  sent: S.statusSent,
  viewed: S.statusViewed,
  accepted: S.statusAccepted,
  declined: S.statusDeclined,
  overdue: S.statusOverdue,
  paid: S.statusPaid,
  void: S.statusVoid,
};

function statusVariant(status: DocStatus): BadgeProps["variant"] {
  switch (status) {
    case "accepted":
    case "paid":
      return "success";
    case "declined":
    case "void":
    case "overdue":
      return "destructive";
    case "sent":
    case "viewed":
      return "secondary";
    case "draft":
      return "outline";
  }
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.DOC_TEMPLATE_NOT_FOUND:
      return S.errors.templateNotFound;
    case ERROR_IDS.DOC_INPUT_INVALID:
      return S.errors.invalid;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.createFailed;
  }
}

interface Props {
  dealId: string;
  canEdit: boolean;
}

export function DealDocumentsSection({ dealId, canEdit }: Props): React.ReactNode {
  const router = useRouter();
  const utils = trpc.useUtils();
  const documents = trpc.documents.forDeal.useQuery({ dealId });
  const rows = documents.data ?? [];

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogKind, setDialogKind] = useState<DocKind | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; isDefault: boolean }>
  >([]);
  const [templateId, setTemplateId] = useState("");

  async function create(kind: DocKind, chosenTemplateId?: string): Promise<void> {
    setPending(true);
    setError(null);
    const result = await createDocumentAction(
      {
        dealId,
        kind,
        ...(chosenTemplateId === undefined ? {} : { templateId: chosenTemplateId }),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    setDialogKind(null);
    router.push(`/documents/${result.value.id}`);
  }

  async function start(kind: DocKind): Promise<void> {
    setError(null);
    try {
      const list = await utils.documents.templates.fetch({ kind });
      // One template needs no choice: create straight away.
      if (list.length <= 1) {
        await create(kind, list[0]?.id);
        return;
      }
      setTemplates(list.map((row) => ({ id: row.id, name: row.name, isDefault: row.isDefault })));
      setTemplateId(list.find((row) => row.isDefault)?.id ?? list[0]?.id ?? "");
      setDialogKind(kind);
    } catch {
      setError(S.createFailed);
    }
  }

  return (
    <CollapsibleSection title={S.documentSection} showFilter={false}>
      <div className="space-y-3 px-3 pb-3" data-testid="deal-documents-section">
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="deal-new-quote"
              disabled={pending}
              onClick={() => void start("quote")}
            >
              {S.newQuote}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="deal-new-invoice"
              disabled={pending}
              onClick={() => void start("invoice")}
            >
              {S.newInvoice}
            </Button>
          </div>
        )}

        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.noDocuments}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/documents/${row.id}`}
                  data-testid="document-row"
                  data-document-id={row.id}
                  data-status={row.status}
                  className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-accent/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.kind === "quote" ? "Quote" : "Invoice"} {row.number ?? S.statusDraft}
                      {row.issueDate === null ? "" : ` · ${longDate(row.issueDate)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {row.total} {row.currency}
                    </span>
                    <Badge variant={statusVariant(row.status)}>{STATUS_LABEL[row.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={dialogKind !== null}
        onOpenChange={(open) => {
          if (!open) setDialogKind(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogKind === "invoice" ? S.newInvoice : S.newQuote}</DialogTitle>
          </DialogHeader>
          <div className="block">
            <span className="mb-1.5 block text-sm font-medium">{S.template}</span>
            <Select
              value={templateId}
              onChange={setTemplateId}
              options={templates.map((template) => ({
                value: template.id,
                label: template.isDefault ? `${template.name} (${S.defaultBadge})` : template.name,
              }))}
              ariaLabel={S.template}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDialogKind(null)}
            >
              {S.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || templateId === ""}
              onClick={() => {
                if (dialogKind !== null) void create(dialogKind, templateId);
              }}
            >
              {pending ? S.creating : S.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollapsibleSection>
  );
}
