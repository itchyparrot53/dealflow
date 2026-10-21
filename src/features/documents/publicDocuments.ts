import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { deals, documentPayments, documents, users } from "@/db/schema";
import { formatCents, parseCents } from "@/features/currency/money";
import { emitDomainEvent } from "@/features/events/emit";
import { createNotification } from "@/features/notifications/produce";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { type DocumentLineView, readLines } from "./lines";
import { checkPublicRateLimit } from "./publicRateLimit";
import { getDocumentSettings } from "./settings";
import { type DocKind, type DocStatus, nextStatus } from "./transitions";
import { renderDocumentBody } from "./variables";

// The public document surface. Requests are addressed only by publicId; no
// session, no internal ids and no customer email leave this module. Drafts and
// void documents are indistinguishable from a missing one.

export interface PublicCompany {
  name: string | null;
  address: string | null;
  taxId: string | null;
}

export interface PublicDocumentView {
  publicId: string;
  kind: DocKind;
  number: string | null;
  title: string;
  body: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  outstanding: string;
  status: DocStatus;
  customerName: string | null;
  customerAddress: string | null;
  issueDate: string | null;
  validUntil: string | null;
  dueDate: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  acceptedName: string | null;
  declineReason: string | null;
  paidAt: string | null;
  expired: boolean;
  lines: DocumentLineView[];
  company: PublicCompany;
  paymentInstructions: string | null;
  footer: string | null;
  ownerName: string;
}

type DocumentRow = typeof documents.$inferSelect;
type DealRow = Pick<
  typeof deals.$inferSelect,
  "id" | "title" | "ownerId" | "deletedAt" | "personId"
>;

const acceptInput = z.object({
  name: z.string().trim().min(1).max(100),
  // A literal true: an unchecked box must never accept a quote.
  agree: z.literal(true),
  ip: z.string().trim().min(1).max(100),
});

const declineInput = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : (value ?? null))),
});

export function notFound(): AppError {
  return new AppError(ERROR_IDS.DOC_NOT_FOUND, "Document not found");
}

function invalid(): AppError {
  return new AppError(ERROR_IDS.DOC_INPUT_INVALID, "public input failed validation");
}

function transitionNotAllowed(status: string): AppError {
  return new AppError(ERROR_IDS.DOC_TRANSITION, "Transition not allowed", { status });
}

function expired(): AppError {
  return new AppError(ERROR_IDS.DOC_EXPIRED, "Quote expired");
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isExpired(row: DocumentRow, today: string): boolean {
  if (row.kind !== "quote") return false;
  if (row.status !== "sent" && row.status !== "viewed") return false;
  return row.validUntil !== null && row.validUntil < today;
}

export function publicHttpStatus(errorId: string): number {
  switch (errorId) {
    case ERROR_IDS.DOC_NOT_FOUND:
      return 404;
    case ERROR_IDS.DOC_TRANSITION:
      return 409;
    case ERROR_IDS.DOC_EXPIRED:
      return 410;
    case ERROR_IDS.DOC_RATE_LIMITED:
      return 429;
    default:
      return 400;
  }
}

async function loadRow(db: DbOrTx, publicId: string): Promise<DocumentRow | undefined> {
  const [row] = await db.select().from(documents).where(eq(documents.publicId, publicId));
  return row;
}

async function loadDeal(db: DbOrTx, dealId: string): Promise<DealRow | undefined> {
  const [row] = await db
    .select({
      id: deals.id,
      title: deals.title,
      ownerId: deals.ownerId,
      deletedAt: deals.deletedAt,
      personId: deals.personId,
    })
    .from(deals)
    .where(eq(deals.id, dealId));
  return row;
}

// A draft or void document is gone publicly, and a quote belonging to a
// soft-deleted deal is gone too. An issued invoice stays visible: it is a
// financial record the customer may still have to pay.
function publiclyVisible(row: DocumentRow, deal: DealRow): boolean {
  if (row.status === "draft" || row.status === "void") return false;
  if (row.kind === "quote" && deal.deletedAt !== null) return false;
  return true;
}

interface RecordedView {
  row: DocumentRow;
  firstView: boolean;
}

async function recordView(db: Db, row: DocumentRow, signal: AbortSignal): Promise<RecordedView> {
  signal.throwIfAborted();
  const firstView = row.viewedAt === null;
  if (!firstView) return { row, firstView };

  // The update and its event share one transaction, so a failed write announces nothing.
  return db.transaction(async (tx) => {
    let updated: DocumentRow | undefined;
    if (row.kind === "quote" && row.status === "sent") {
      [updated] = await tx
        .update(documents)
        .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
        .where(eq(documents.id, row.id))
        .returning();
    } else if (row.kind === "invoice") {
      // An invoice keeps its status; only the first view is recorded.
      [updated] = await tx
        .update(documents)
        .set({ viewedAt: new Date(), updatedAt: new Date() })
        .where(eq(documents.id, row.id))
        .returning();
    } else {
      return { row, firstView };
    }
    if (updated !== undefined) {
      await emitDomainEvent(
        tx,
        { type: "document.viewed", entityType: "document", entityId: updated.id, actorId: null },
        signal,
      );
    }
    return { row: updated ?? row, firstView };
  });
}

async function outstandingFor(db: DbOrTx, row: DocumentRow): Promise<string> {
  if (row.kind !== "invoice") return "0.00";
  const payments = await db
    .select({ amount: documentPayments.amount })
    .from(documentPayments)
    .where(eq(documentPayments.documentId, row.id));
  let paid = 0n;
  for (const payment of payments) paid += parseCents(payment.amount);
  const outstanding = parseCents(row.total) - paid;
  return formatCents(outstanding < 0n ? 0n : outstanding);
}

async function buildView(
  db: Db,
  row: DocumentRow,
  signal: AbortSignal,
): Promise<PublicDocumentView> {
  const deal = await loadDeal(db, row.dealId);
  if (deal === undefined) throw notFound();
  const settings = await getDocumentSettings(db, signal);
  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, deal.ownerId));
  const lines = await readLines(db, row.id, signal);
  const outstanding = await outstandingFor(db, row);
  signal.throwIfAborted();
  return {
    publicId: row.publicId,
    kind: row.kind as DocKind,
    number: row.number,
    title: row.title,
    body: renderDocumentBody(row.body, row),
    currency: row.currency,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    outstanding,
    status: row.status as DocStatus,
    customerName: row.customerName,
    customerAddress: row.customerAddress,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    dueDate: row.dueDate,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    acceptedName: row.acceptedName,
    declineReason: row.declineReason,
    paidAt: row.paidAt?.toISOString() ?? null,
    expired: isExpired(row, todayUtc()),
    lines,
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      taxId: settings.companyTaxId,
    },
    paymentInstructions: settings.paymentInstructions,
    footer: settings.footer,
    ownerName: owner?.name ?? "",
  };
}

type DocumentNotification = "document_viewed" | "document_accepted" | "document_declined";

// Notification delivery is best-effort: the public action already succeeded, so a
// failed insert is reported and never turned into a user-facing error.
async function notifyOwner(
  db: Db,
  row: DocumentRow,
  deal: DealRow,
  type: DocumentNotification,
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<void> {
  try {
    const result = await createNotification(
      db,
      {
        recipientId: row.createdBy ?? deal.ownerId,
        type,
        // The deal is the visibility parent (the shared deal predicate gates it);
        // payloadHref opens the document itself.
        entityType: "deal",
        entityId: deal.id,
        actorId: null,
        payload: { documentId: row.id, title: row.title, ...payload },
      },
      signal,
    );
    if (!result.ok) console.error(`documents: ${type} notification failed: ${result.error.id}`);
  } catch (error) {
    // Abort stays a cancellation; anything else is a failed best-effort notification.
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.error(`documents: ${type} notification threw`, error);
  }
}

async function loadVisible(
  db: Db,
  publicId: string,
  signal: AbortSignal,
): Promise<Result<{ row: DocumentRow; deal: DealRow }, AppError>> {
  const row = await loadRow(db, publicId);
  if (row === undefined) return err(notFound());
  const deal = await loadDeal(db, row.dealId);
  if (deal === undefined) return err(notFound());
  signal.throwIfAborted();
  if (!publiclyVisible(row, deal)) return err(notFound());
  return ok({ row, deal });
}

export async function getPublicDocument(
  db: Db,
  publicId: string,
  opts: { ip: string },
  signal: AbortSignal,
): Promise<Result<PublicDocumentView, AppError>> {
  const limited = checkPublicRateLimit(opts.ip, publicId);
  if (!limited.ok) return limited;
  const visible = await loadVisible(db, publicId, signal);
  if (!visible.ok) return visible;
  const viewed = await recordView(db, visible.value.row, signal);
  if (viewed.firstView) {
    await notifyOwner(
      db,
      viewed.row,
      visible.value.deal,
      "document_viewed",
      { customer: viewed.row.customerName ?? "Someone" },
      signal,
    );
  }
  return ok(await buildView(db, viewed.row, signal));
}

export async function acceptQuote(
  db: Db,
  publicId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PublicDocumentView, AppError>> {
  const parsed = acceptInput.safeParse(raw);
  if (!parsed.success) return err(invalid());
  const visible = await loadVisible(db, publicId, signal);
  if (!visible.ok) return visible;
  const row = visible.value.row;
  if (row.kind !== "quote") return err(transitionNotAllowed(row.status));
  if (isExpired(row, todayUtc())) return err(expired());
  if (nextStatus("quote", row.status as DocStatus, "accept") === null) {
    return err(transitionNotAllowed(row.status));
  }

  // Conditional on the status we read: two accepts cannot both win.
  const [updated] = await db.transaction(async (tx) => {
    const [rowUpdated] = await tx
      .update(documents)
      .set({
        status: "accepted",
        acceptedName: parsed.data.name,
        acceptedAt: new Date(),
        acceptedIp: parsed.data.ip,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, row.id), eq(documents.status, row.status)))
      .returning();
    if (rowUpdated !== undefined) {
      await emitDomainEvent(
        tx,
        {
          type: "document.accepted",
          entityType: "document",
          entityId: rowUpdated.id,
          actorId: null,
        },
        signal,
      );
    }
    return [rowUpdated];
  });
  if (updated === undefined) return err(transitionNotAllowed(row.status));
  signal.throwIfAborted();
  await notifyOwner(
    db,
    updated,
    visible.value.deal,
    "document_accepted",
    {
      name: parsed.data.name,
    },
    signal,
  );
  return ok(await buildView(db, updated, signal));
}

export async function declineQuote(
  db: Db,
  publicId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PublicDocumentView, AppError>> {
  const parsed = declineInput.safeParse(raw ?? {});
  if (!parsed.success) return err(invalid());
  const visible = await loadVisible(db, publicId, signal);
  if (!visible.ok) return visible;
  const row = visible.value.row;
  if (row.kind !== "quote") return err(transitionNotAllowed(row.status));
  if (isExpired(row, todayUtc())) return err(expired());
  if (nextStatus("quote", row.status as DocStatus, "decline") === null) {
    return err(transitionNotAllowed(row.status));
  }

  const [updated] = await db.transaction(async (tx) => {
    const [rowUpdated] = await tx
      .update(documents)
      .set({
        status: "declined",
        declinedAt: new Date(),
        declineReason: parsed.data.reason,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, row.id), eq(documents.status, row.status)))
      .returning();
    if (rowUpdated !== undefined) {
      await emitDomainEvent(
        tx,
        {
          type: "document.declined",
          entityType: "document",
          entityId: rowUpdated.id,
          actorId: null,
        },
        signal,
      );
    }
    return [rowUpdated];
  });
  if (updated === undefined) return err(transitionNotAllowed(row.status));
  signal.throwIfAborted();
  await notifyOwner(db, updated, visible.value.deal, "document_declined", {}, signal);
  return ok(await buildView(db, updated, signal));
}
