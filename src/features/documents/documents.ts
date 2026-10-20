import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  deals,
  dealTerms,
  documentPayments,
  documents,
  documentTemplates,
  organizations,
  persons,
  users,
} from "@/db/schema";
import { formatCents, formatMoney, parseCents } from "@/features/currency/money";
import { readBaseCurrency } from "@/features/currency/rates";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import type { PermSetUser } from "@/features/permissions/effective";
import { assertDealVisible } from "@/features/products/dealProducts";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import {
  type DocumentLineView,
  type LineSnapshot,
  readLines,
  replaceLines,
  snapshotFromDeal,
  snapshotFromDocument,
} from "./lines";
import { getDocumentSettings } from "./settings";
import { listTemplates } from "./templates";
import type { DocKind, DocStatus } from "./transitions";
import { renderVariables } from "./variables";

// Quotes and invoices. A document owns a snapshot of lines, customer fields and a
// rendered body; issuing (issue.ts) is the only thing that assigns a number.

const PUBLIC_ID_BYTES = 18;
const MAX_TITLE = 150;
const MAX_LIST = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DocumentSummary {
  id: string;
  kind: DocKind;
  dealId: string;
  number: string | null;
  title: string;
  status: DocStatus;
  currency: string;
  total: string;
  issueDate: string | null;
  validUntil: string | null;
  dueDate: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPaymentView {
  id: string;
  amount: string;
  paidOn: string;
  method: string;
  reference: string | null;
  createdAt: string;
}

export interface DocumentView extends DocumentSummary {
  dealTitle: string;
  templateId: string | null;
  sourceQuoteId: string | null;
  publicId: string;
  body: string;
  subtotal: string;
  tax: string;
  customerEmail: string | null;
  customerAddress: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  acceptedName: string | null;
  declineReason: string | null;
  lines: DocumentLineView[];
  payments: DocumentPaymentView[];
  outstanding: string;
  expired: boolean;
  publicUrl: string;
}

export const createDocumentInput = z.object({
  dealId: z.string().uuid(),
  kind: z.enum(["quote", "invoice"]),
  templateId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(MAX_TITLE).optional(),
  sourceQuoteId: z.string().uuid().optional(),
});

export const updateDraftInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(MAX_TITLE).optional(),
  body: z.string().min(1).max(20000).optional(),
  validUntil: z.string().regex(ISO_DATE).nullable().optional(),
  dueDate: z.string().regex(ISO_DATE).nullable().optional(),
  customerName: z.string().trim().max(200).nullable().optional(),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  customerAddress: z.string().trim().max(2000).nullable().optional(),
});

export const documentIdInput = z.object({ id: z.string().uuid() });
export const dealDocumentsInput = z.object({ dealId: z.string().uuid() });

type DocumentRow = typeof documents.$inferSelect;
type DealRow = typeof deals.$inferSelect;

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.DOC_NOT_FOUND, "Document not found", { documentId: id });
}

function invalid(): AppError {
  return new AppError(ERROR_IDS.DOC_INPUT_INVALID, "document input failed validation");
}

function transitionNotAllowed(status: string): AppError {
  return new AppError(ERROR_IDS.DOC_TRANSITION, "Transition not allowed", { status });
}

// Document operations surface a missing or invisible deal as a missing document,
// so a public or shared caller cannot probe deal ids through this feature.
function mapDealError(error: AppError): AppError {
  if (error.id === ERROR_IDS.DEAL_NOT_FOUND) {
    return new AppError(ERROR_IDS.DOC_NOT_FOUND, "Deal not found", error.context);
  }
  return error;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function iso(ts: Date | null): string | null {
  return ts === null ? null : ts.toISOString();
}

function formatOrgAddress(address: Record<string, unknown> | null): string | null {
  if (address === null) return null;
  const parts: string[] = [];
  for (const key of ["street", "city", "region", "postal", "country"]) {
    const value = address[key];
    if (typeof value === "string" && value.trim() !== "") parts.push(value.trim());
  }
  return parts.length === 0 ? null : parts.join(", ");
}

function isExpired(row: DocumentRow, today: string): boolean {
  if (row.kind !== "quote") return false;
  if (row.status !== "sent" && row.status !== "viewed") return false;
  return row.validUntil !== null && row.validUntil < today;
}

function toSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    kind: row.kind as DocKind,
    dealId: row.dealId,
    number: row.number,
    title: row.title,
    status: row.status as DocStatus,
    currency: row.currency,
    total: row.total,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    dueDate: row.dueDate,
    customerName: row.customerName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function paymentViews(rows: Array<typeof documentPayments.$inferSelect>): DocumentPaymentView[] {
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    paidOn: row.paidOn,
    method: row.method,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
  }));
}

function outstandingFor(total: string, payments: DocumentPaymentView[]): string {
  let outstanding = parseCents(total);
  for (const payment of payments) outstanding -= parseCents(payment.amount);
  return formatCents(outstanding < 0n ? 0n : outstanding);
}

function toView(
  row: DocumentRow,
  dealTitle: string,
  lines: DocumentLineView[],
  payments: DocumentPaymentView[],
): DocumentView {
  return {
    ...toSummary(row),
    dealTitle,
    templateId: row.templateId,
    sourceQuoteId: row.sourceQuoteId,
    publicId: row.publicId,
    body: row.body,
    subtotal: row.subtotal,
    tax: row.tax,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    sentAt: iso(row.sentAt),
    viewedAt: iso(row.viewedAt),
    acceptedAt: iso(row.acceptedAt),
    declinedAt: iso(row.declinedAt),
    paidAt: iso(row.paidAt),
    voidedAt: iso(row.voidedAt),
    acceptedName: row.acceptedName,
    declineReason: row.declineReason,
    lines,
    payments,
    outstanding: outstandingFor(row.total, payments),
    expired: isExpired(row, todayUtc()),
    publicUrl: `${env.BASE_URL}/d/${row.publicId}`,
  };
}

async function loadDocumentRow(db: DbOrTx, id: string): Promise<DocumentRow | undefined> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  return row;
}

async function loadDealTitle(db: DbOrTx, dealId: string): Promise<string> {
  const [row] = await db.select({ title: deals.title }).from(deals).where(eq(deals.id, dealId));
  return row?.title ?? "";
}

interface CustomerFields {
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  person: typeof persons.$inferSelect | undefined;
  org: typeof organizations.$inferSelect | undefined;
}

async function readCustomer(db: DbOrTx, deal: DealRow): Promise<CustomerFields> {
  let person: typeof persons.$inferSelect | undefined;
  let org: typeof organizations.$inferSelect | undefined;
  if (deal.personId !== null) {
    [person] = await db.select().from(persons).where(eq(persons.id, deal.personId));
  }
  if (deal.orgId !== null) {
    [org] = await db.select().from(organizations).where(eq(organizations.id, deal.orgId));
  }
  return {
    // The person is the addressee; the organization is the fallback addressee.
    customerName: person?.name ?? org?.name ?? null,
    customerEmail: person?.primaryEmail ?? null,
    customerAddress: formatOrgAddress(org?.address ?? null),
    person,
    org,
  };
}

async function variableContext(
  db: DbOrTx,
  deal: DealRow,
  customer: CustomerFields,
  currency: string,
  companyName: string | null,
): Promise<Record<string, string>> {
  const [owner] = await db.select().from(users).where(eq(users.id, deal.ownerId));
  const value = deal.value === null ? "" : formatMoney(parseCents(deal.value), currency);
  return {
    "deal.title": deal.title,
    "deal.value": value,
    "person.name": customer.person?.name ?? "",
    "person.first_name": customer.person?.firstName ?? customer.person?.name.split(" ")[0] ?? "",
    "organization.name": customer.org?.name ?? "",
    "owner.name": owner?.name ?? "",
    "owner.email": owner?.email ?? "",
    "company.name": companyName ?? owner?.name ?? "",
  };
}

function renderBody(
  template: { body: string; terms: string | null },
  ctx: Record<string, string>,
): string {
  // document.* stays for the display pass: number, totals and dates can still change.
  const body = renderVariables(template.body, ctx, { keepPrefix: "document." });
  if (template.terms === null) return body;
  const terms = renderVariables(template.terms, ctx, { keepPrefix: "document." });
  return `${body}\n\n## Terms\n${terms}`;
}

function defaultTitle(kind: DocKind, dealTitle: string): string {
  const prefix = kind === "quote" ? "Quote for" : "Invoice for";
  return `${prefix} ${dealTitle}`.slice(0, MAX_TITLE);
}

export async function createDocument(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  const parsed = createDocumentInput.safeParse(raw);
  if (!parsed.success) return err(invalid());
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const editable = await loadEditableDeal(tx, actor, input.dealId, signal);
    if (!editable.ok) return err(mapDealError(editable.error));
    const deal = editable.value.deal;

    const [termsRow] = await tx
      .select({ currency: dealTerms.currency })
      .from(dealTerms)
      .where(eq(dealTerms.dealId, deal.id));
    const currency = termsRow?.currency ?? (await readBaseCurrency(tx, signal));

    const templates = await listTemplates(tx, input.kind, signal);
    const template =
      input.templateId === undefined
        ? (templates.find((row) => row.isDefault) ?? templates[0])
        : templates.find((row) => row.id === input.templateId);
    if (template === undefined) {
      return err(
        new AppError(ERROR_IDS.DOC_TEMPLATE_NOT_FOUND, "Template not found", {
          templateId: input.templateId,
        }),
      );
    }

    let snapshot: LineSnapshot;
    if (input.sourceQuoteId !== undefined) {
      const source = await loadDocumentRow(tx, input.sourceQuoteId);
      if (source === undefined || source.kind !== "quote" || source.dealId !== deal.id) {
        return err(notFound(input.sourceQuoteId));
      }
      if (source.status !== "accepted") return err(transitionNotAllowed(source.status));
      snapshot = await snapshotFromDocument(tx, source.id, signal);
    } else {
      snapshot = await snapshotFromDeal(
        tx,
        {
          dealId: deal.id,
          dealTitle: deal.title,
          dealValue: deal.value,
          includeProducts: template.includeProducts,
        },
        signal,
      );
    }

    const customer = await readCustomer(tx, deal);
    const settings = await getDocumentSettings(tx, signal);
    const ctx = await variableContext(tx, deal, customer, currency, settings.companyName);
    const body = renderBody(template, ctx);
    signal.throwIfAborted();

    const [row] = await tx
      .insert(documents)
      .values({
        kind: input.kind,
        dealId: deal.id,
        templateId: template.id,
        sourceQuoteId: input.sourceQuoteId ?? null,
        publicId: randomBytes(PUBLIC_ID_BYTES).toString("base64url"),
        title: input.title ?? defaultTitle(input.kind, deal.title),
        body,
        currency,
        subtotal: snapshot.subtotal,
        tax: snapshot.tax,
        total: snapshot.total,
        status: "draft",
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        customerAddress: customer.customerAddress,
        validUntil: input.kind === "quote" ? addDays(todayUtc(), settings.quoteValidDays) : null,
        createdBy: actor.id,
      })
      .returning();
    if (row === undefined) {
      throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "createDocument: insert returned no rows");
    }
    await replaceLines(tx, row.id, snapshot);
    const lines = await readLines(tx, row.id, signal);
    return ok(toView(row, deal.title, lines, []));
  });
}

export async function updateDraft(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  const parsed = updateDraftInput.safeParse(raw);
  if (!parsed.success) return err(invalid());
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const row = await loadDocumentRow(tx, input.id);
    if (row === undefined) return err(notFound(input.id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(mapDealError(editable.error));
    if (row.status !== "draft") {
      return err(
        new AppError(ERROR_IDS.DOC_IMMUTABLE, "Issued documents cannot be edited", {
          documentId: row.id,
          status: row.status,
        }),
      );
    }

    const { id, ...values } = input;
    const [updated] = await tx
      .update(documents)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    if (updated === undefined) {
      throw new AppError(ERROR_IDS.DB_WRITE_FAILED, "updateDraft: update returned no rows");
    }
    const lines = await readLines(tx, id, signal);
    const payments = await tx
      .select()
      .from(documentPayments)
      .where(eq(documentPayments.documentId, id));
    return ok(toView(updated, editable.value.deal.title, lines, paymentViews(payments)));
  });
}

export async function refreshLines(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  return db.transaction(async (tx) => {
    const row = await loadDocumentRow(tx, id);
    if (row === undefined) return err(notFound(id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(mapDealError(editable.error));
    if (row.status !== "draft") {
      return err(
        new AppError(ERROR_IDS.DOC_IMMUTABLE, "Issued documents cannot be edited", {
          documentId: row.id,
          status: row.status,
        }),
      );
    }

    let includeProducts = true;
    if (row.templateId !== null) {
      const [template] = await tx
        .select({ includeProducts: documentTemplates.includeProducts })
        .from(documentTemplates)
        .where(eq(documentTemplates.id, row.templateId));
      includeProducts = template?.includeProducts ?? true;
    }
    const deal = editable.value.deal;
    const snapshot = await snapshotFromDeal(
      tx,
      {
        dealId: deal.id,
        dealTitle: deal.title,
        dealValue: deal.value,
        includeProducts,
      },
      signal,
    );
    await replaceLines(tx, id, snapshot);
    const [updated] = await tx
      .update(documents)
      .set({
        subtotal: snapshot.subtotal,
        tax: snapshot.tax,
        total: snapshot.total,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    if (updated === undefined) {
      throw new AppError(ERROR_IDS.DB_WRITE_FAILED, "refreshLines: update returned no rows");
    }
    const lines = await readLines(tx, id, signal);
    return ok(toView(updated, deal.title, lines, []));
  });
}

export async function duplicateDocument(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  return db.transaction(async (tx) => {
    const row = await loadDocumentRow(tx, id);
    if (row === undefined) return err(notFound(id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(mapDealError(editable.error));

    const snapshot = await snapshotFromDocument(tx, row.id, signal);
    const settings = await getDocumentSettings(tx, signal);
    const [copy] = await tx
      .insert(documents)
      .values({
        kind: row.kind,
        dealId: row.dealId,
        templateId: row.templateId,
        sourceQuoteId: row.sourceQuoteId,
        publicId: randomBytes(PUBLIC_ID_BYTES).toString("base64url"),
        title: `${row.title} (copy)`.slice(0, MAX_TITLE),
        body: row.body,
        currency: row.currency,
        subtotal: snapshot.subtotal,
        tax: snapshot.tax,
        total: snapshot.total,
        status: "draft",
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        customerAddress: row.customerAddress,
        validUntil: row.kind === "quote" ? addDays(todayUtc(), settings.quoteValidDays) : null,
        createdBy: actor.id,
      })
      .returning();
    if (copy === undefined) {
      throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "duplicateDocument: insert returned no rows");
    }
    await replaceLines(tx, copy.id, snapshot);
    const lines = await readLines(tx, copy.id, signal);
    return ok(toView(copy, editable.value.deal.title, lines, []));
  });
}

export async function deleteDraft(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  return db.transaction(async (tx) => {
    const row = await loadDocumentRow(tx, id);
    if (row === undefined) return err(notFound(id));
    const editable = await loadEditableDeal(tx, actor, row.dealId, signal);
    if (!editable.ok) return err(mapDealError(editable.error));
    if (row.status !== "draft") {
      if (row.kind === "invoice") {
        return err(
          new AppError(ERROR_IDS.DOC_INVOICE_DELETE, "Issued invoices cannot be deleted", {
            documentId: id,
          }),
        );
      }
      return err(transitionNotAllowed(row.status));
    }
    await tx.delete(documents).where(eq(documents.id, id));
    return ok(undefined);
  });
}

export async function getDocument(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  const row = await loadDocumentRow(db, id);
  if (row === undefined) return err(notFound(id));
  const visible = await assertDealVisible(db, actor, row.dealId, signal);
  if (!visible.ok) return err(mapDealError(visible.error));

  const [dealTitle, lines, payments] = await Promise.all([
    loadDealTitle(db, row.dealId),
    readLines(db, id, signal),
    db.select().from(documentPayments).where(eq(documentPayments.documentId, id)),
  ]);
  signal.throwIfAborted();
  return ok(toView(row, dealTitle, lines, paymentViews(payments)));
}

export async function listDocumentsForDeal(
  db: Db,
  actor: PermSetUser,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DocumentSummary[], AppError>> {
  const visible = await assertDealVisible(db, actor, dealId, signal);
  if (!visible.ok) return err(mapDealError(visible.error));
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.dealId, dealId))
    .orderBy(desc(documents.createdAt))
    .limit(MAX_LIST);
  signal.throwIfAborted();
  return ok(rows.map(toSummary));
}

// Narrowed summary for the /documents list (Task 3.3), which needs the deal title.
export async function listDocumentsForActor(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<Result<Array<DocumentSummary & { dealTitle: string }>, AppError>> {
  const rows = await db
    .select({ document: documents, dealTitle: deals.title })
    .from(documents)
    .innerJoin(deals, eq(deals.id, documents.dealId))
    .orderBy(desc(documents.createdAt))
    .limit(MAX_LIST);
  signal.throwIfAborted();
  const visible: Array<DocumentSummary & { dealTitle: string }> = [];
  for (const row of rows) {
    const check = await assertDealVisible(db, actor, row.document.dealId, signal);
    if (check.ok) visible.push({ ...toSummary(row.document), dealTitle: row.dealTitle });
  }
  return ok(visible);
}
