import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  dealProducts,
  deals,
  documentCounters,
  documentSettings,
  documents,
  documentTemplates,
  organizations,
  persons,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import {
  dealTotals,
  formatCents,
  parseBp,
  parseCents,
  parseMilli,
} from "@/features/currency/money";
import { saveRate } from "@/features/currency/rates";
import { FakeStorageClient } from "@/features/files/storageFake";
import { connectImapMailbox } from "@/features/mail/connect/connect";
import { createFakeTransportFactory } from "@/features/mail/transport/fake";
import { fakeRead } from "@/features/mail/transport/fakeStore";
import type { PermSetUser } from "@/features/permissions/effective";
import { addDealLine } from "@/features/products/dealProducts";
import { setDealTerms } from "@/features/products/dealTerms";
import { createProduct } from "@/features/products/products";
import { hydrateActor } from "@/server/hydrateActor";
import { makeTestDb } from "@/test/db";
import {
  createDocument,
  deleteDraft,
  duplicateDocument,
  getDocument,
  listDocumentsForDeal,
  loadDocumentsList,
  refreshLines,
  updateDraft,
} from "./documents";
import { issueDocument, voidInvoice } from "./issue";
import { formatDocNumber } from "./numbering";
import { runOverdueInvoices } from "./overdueJob";
import { deletePayment, recordPayment } from "./payments";
import { sendDocument } from "./send";
import { getDocumentSettings, updateDocumentSettings } from "./settings";
import { createTemplate, deleteTemplate, listTemplates, setDefaultTemplate } from "./templates";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let regular: PermSetUser;
let pipelineId: string;
let stageId: string;
let usdProductId: string;
let eurProductId: string;
let personId: string;
let orgId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true, name: "Admin User" });
  const regularRow = await seedUser(h.db, { name: "Regular User" });
  admin = { id: adminRow.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  regular = {
    id: regularRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    // Its own deals only: the visibility case below still fails on canSee first.
    flags: new Set(["deal.edit_own"]),
  };
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
  await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());

  const usd = await createProduct(
    h.db,
    admin,
    { name: "Consulting", price: "1200.00", currency: "USD", taxPercent: "20" },
    sig(),
  );
  const eur = await createProduct(
    h.db,
    admin,
    { name: "Euro widget", price: "100.00", currency: "EUR", taxPercent: "0" },
    sig(),
  );
  usdProductId = usd.ok ? usd.value.id : "";
  eurProductId = eur.ok ? eur.value.id : "";

  const [person] = await h.db
    .insert(persons)
    .values({
      name: "Ada Lovelace",
      firstName: "Ada",
      primaryEmail: "ada@example.com",
      ownerId: admin.id,
      visibilityLevel: "all",
    })
    .returning();
  const [org] = await h.db
    .insert(organizations)
    .values({
      name: "Analytical Engines",
      address: { street: "1 Engine Way", city: "London", country: "GB" },
      ownerId: admin.id,
      visibilityLevel: "all",
    })
    .returning();
  personId = person?.id ?? "";
  orgId = org?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

async function seedDeal(options: {
  value?: string | null;
  visibility?: "all" | "owner";
  ownerId?: string;
  withContact?: boolean;
}): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Big deal",
      pipelineId,
      stageId,
      ownerId: options.ownerId ?? admin.id,
      visibilityLevel: options.visibility ?? "all",
      boardPosition: "0",
      value: options.value ?? null,
      personId: options.withContact === false ? null : personId,
      orgId: options.withContact === false ? null : orgId,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "seedDeal failed");
  return row;
}

async function addLine(dealId: string, productId: string, quantity = "1", discount = "0") {
  const result = await addDealLine(
    h.db,
    admin,
    { dealId, productId, quantity, discountPercent: discount },
    sig(),
  );
  if (!result.ok) throw new Error(`addDealLine failed: ${result.error.id}`);
  return result.value.line;
}

describe("createDocument", () => {
  it("snapshots deal lines with totals equal to dealTotals", async () => {
    const deal = await seedDeal({});
    await addLine(deal.id, usdProductId, "2", "10");
    await addLine(deal.id, usdProductId, "1", "0");

    const result = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value;

    expect(doc.currency).toBe("USD");
    expect(doc.status).toBe("draft");
    expect(doc.number).toBeNull();
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]?.name).toBe("Consulting");
    expect(doc.lines[0]?.quantity).toBe("2.000");
    // Two 1200 units with 10% discount: net 2160.00, tax 20% = 432.00.
    expect(doc.lines[0]?.net).toBe("2160.00");
    expect(doc.lines[0]?.tax).toBe("432.00");
    expect(doc.lines[0]?.gross).toBe("2592.00");
    // The second line is undiscounted: net 1200.00, tax 240.00.
    expect(doc.lines[1]?.net).toBe("1200.00");
    expect(doc.lines[1]?.tax).toBe("240.00");
    expect(doc.subtotal).toBe("3360.00");
    expect(doc.tax).toBe("672.00");
    expect(doc.total).toBe("4032.00");
    expect(doc.outstanding).toBe("4032.00");
    expect(doc.expired).toBe(false);
    expect(doc.publicUrl.endsWith(`/d/${doc.publicId}`)).toBe(true);

    // The document totals are exactly Part 3's dealTotals over the deal's lines.
    const dealLines = await h.db
      .select()
      .from(dealProducts)
      .where(eq(dealProducts.dealId, deal.id));
    const totals = dealTotals(
      dealLines.map((line) => ({
        qty: parseMilli(line.quantity),
        price: parseCents(line.itemPrice),
        discount: parseBp(line.discountPercent),
        tax: parseBp(line.taxPercent),
      })),
    );
    expect(doc.subtotal).toBe(formatCents(totals.net));
    expect(doc.tax).toBe(formatCents(totals.tax));
    expect(doc.total).toBe(formatCents(totals.gross));
  });

  it("gives one line from the deal value when the deal has no products", async () => {
    const deal = await seedDeal({ value: "5000.00" });
    const result = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines).toHaveLength(1);
    expect(result.value.lines[0]?.name).toBe("Big deal");
    expect(result.value.lines[0]?.quantity).toBe("1.000");
    expect(result.value.lines[0]?.itemPrice).toBe("5000.00");
    expect(result.value.lines[0]?.tax).toBe("0.00");
    expect(result.value.total).toBe("5000.00");
    expect(result.value.title).toBe("Invoice for Big deal");
    expect(result.value.dueDate).toBeNull();
  });

  it("uses the deal currency for a EUR deal", async () => {
    const deal = await seedDeal({});
    const terms = await setDealTerms(h.db, admin, { dealId: deal.id, currency: "EUR" }, sig());
    expect(terms.ok).toBe(true);
    await addLine(deal.id, eurProductId, "1", "0");
    const result = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currency).toBe("EUR");
    expect(result.value.lines[0]?.itemPrice).toBe("100.00");
  });

  it("renders customer, organization, company and owner but keeps document.*", async () => {
    const settings = await getDocumentSettings(h.db, sig());
    expect(settings.quotePrefix).toBe("Q");
    const update = await updateDocumentSettings(
      h.db,
      admin,
      {
        quotePrefix: "Q",
        invoicePrefix: "INV",
        quoteValidDays: 30,
        invoiceDueDays: 14,
        companyName: "Acme Ltd",
        companyAddress: "1 Acme Road",
        companyTaxId: null,
        paymentInstructions: null,
        footer: null,
      },
      sig(),
    );
    expect(update.ok).toBe(true);

    const deal = await seedDeal({ value: "100.00" });
    const result = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const body = result.value.body;
    expect(body).toContain("# Quote {{document.number}} for Analytical Engines");
    expect(body).toContain("Prepared for Ada Lovelace by Admin User, Acme Ltd.");
    expect(body).toContain("Big deal");
    const terms = await listTemplates(h.db, "quote", sig());
    expect(body).toContain(terms[0]?.terms ?? "MISSING TERMS");
    expect(body).toContain("{{document.valid_until}}");
  });

  it("refuses a deal the actor cannot see with E_DOC_001", async () => {
    const deal = await seedDeal({ visibility: "owner", ownerId: admin.id });
    const result = await createDocument(h.db, regular, { dealId: deal.id, kind: "quote" }, sig());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);

    const own = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(own.ok).toBe(true);
    if (!own.ok) return;
    const read = await getDocument(h.db, regular, own.value.id, sig());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);
  });
});

describe("updateDraft", () => {
  it("edits a draft and refuses an issued document with E_DOC_002", async () => {
    const deal = await seedDeal({ value: "10.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edited = await updateDraft(
      h.db,
      admin,
      { id: created.value.id, title: "Edited title", customerEmail: "new@example.com" },
      sig(),
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.title).toBe("Edited title");
    expect(edited.value.customerEmail).toBe("new@example.com");

    await h.db.update(documents).set({ status: "sent" }).where(eq(documents.id, created.value.id));
    const refused = await updateDraft(h.db, admin, { id: created.value.id, title: "Nope" }, sig());
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.id).toBe(ERROR_IDS.DOC_IMMUTABLE);
  });
});

describe("refreshLines", () => {
  it("copies the deal's current lines onto a draft", async () => {
    const deal = await seedDeal({});
    await addLine(deal.id, usdProductId, "1", "0");
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.lines).toHaveLength(1);
    expect(created.value.total).toBe("1440.00");

    await addLine(deal.id, usdProductId, "2", "0");
    const refreshed = await refreshLines(h.db, admin, created.value.id, sig());
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.value.lines).toHaveLength(2);
    expect(refreshed.value.subtotal).toBe("3600.00");
    expect(refreshed.value.total).toBe("4320.00");
  });
});

describe("duplicateDocument", () => {
  it("copies the lines into a new draft with a (copy) title and no number", async () => {
    const deal = await seedDeal({});
    await addLine(deal.id, usdProductId, "1", "0");
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const copy = await duplicateDocument(h.db, admin, created.value.id, sig());
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.id).not.toBe(created.value.id);
    expect(copy.value.title).toBe("Quote for Big deal (copy)");
    expect(copy.value.status).toBe("draft");
    expect(copy.value.number).toBeNull();
    expect(copy.value.publicId).not.toBe(created.value.publicId);
    expect(copy.value.lines).toHaveLength(1);
    expect(copy.value.total).toBe(created.value.total);
  });
});

describe("listDocumentsForDeal", () => {
  it("lists the deal's documents and refuses an invisible deal", async () => {
    const deal = await seedDeal({ value: "1.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    const listed = await listDocumentsForDeal(h.db, admin, deal.id, sig());
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((row) => row.id)).toContain(created.ok ? created.value.id : "");

    const hidden = await seedDeal({ visibility: "owner", ownerId: admin.id });
    const refused = await listDocumentsForDeal(h.db, regular, hidden.id, sig());
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);
  });
});

describe("document settings", () => {
  it("inserts the defaults once", async () => {
    await h.db.delete(documentSettings);
    const first = await getDocumentSettings(h.db, sig());
    expect(first.quotePrefix).toBe("Q");
    expect(first.invoicePrefix).toBe("INV");
    expect(first.quoteValidDays).toBe(30);
    expect(first.invoiceDueDays).toBe(14);
    await getDocumentSettings(h.db, sig());
    const rows = await h.db.select().from(documentSettings);
    expect(rows).toHaveLength(1);
  });

  it("refuses an update from a user without documents.manage", async () => {
    const result = await updateDocumentSettings(
      h.db,
      regular,
      {
        quotePrefix: "Q",
        invoicePrefix: "INV",
        quoteValidDays: 30,
        invoiceDueDays: 14,
        companyName: null,
        companyAddress: null,
        companyTaxId: null,
        paymentInstructions: null,
        footer: null,
      },
      sig(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.PERM_DENIED);
  });
});

describe("document templates", () => {
  it("inserts one default per kind on first list and does not duplicate it", async () => {
    await h.db.delete(documentTemplates);
    const quotes = await listTemplates(h.db, "quote", sig());
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.name).toBe("Standard quote");
    expect(quotes[0]?.isDefault).toBe(true);
    expect(await listTemplates(h.db, "quote", sig())).toHaveLength(1);

    const invoices = await listTemplates(h.db, "invoice", sig());
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.name).toBe("Standard invoice");
    expect(invoices[0]?.includeProducts).toBe(true);
  });

  it("creates, sets the default and refuses to delete the last template of a kind", async () => {
    const created = await createTemplate(
      h.db,
      admin,
      { kind: "quote", name: "Short quote", body: "# Hi", terms: null, includeProducts: false },
      sig(),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.isDefault).toBe(false);

    const promoted = await setDefaultTemplate(h.db, admin, created.value.id, sig());
    expect(promoted.ok).toBe(true);
    const quotes = await listTemplates(h.db, "quote", sig());
    expect(quotes.filter((row) => row.isDefault)).toHaveLength(1);
    expect(quotes.find((row) => row.id === created.value.id)?.isDefault).toBe(true);

    const builtIn = quotes.find((row) => row.id !== created.value.id);
    expect(builtIn).toBeDefined();
    if (builtIn === undefined) return;
    const removed = await deleteTemplate(h.db, admin, builtIn.id, sig());
    expect(removed.ok).toBe(true);

    const last = await listTemplates(h.db, "quote", sig());
    expect(last).toHaveLength(1);
    const refused = await deleteTemplate(h.db, admin, last[0]?.id ?? "", sig());
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.id).toBe(ERROR_IDS.DOC_LAST_TEMPLATE);
  });

  it("refuses template mutations from a user without documents.manage", async () => {
    const result = await createTemplate(
      h.db,
      regular,
      { kind: "invoice", name: "Nope", body: "# No", terms: null, includeProducts: true },
      sig(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.PERM_DENIED);
  });
});

describe("deleteDraft", () => {
  it("deletes a draft with its lines", async () => {
    const deal = await seedDeal({ value: "10.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const removed = await deleteDraft(h.db, admin, created.value.id, sig());
    expect(removed.ok).toBe(true);
    const [row] = await h.db.select().from(documents).where(eq(documents.id, created.value.id));
    expect(row).toBeUndefined();
  });
});

describe("issue and void", () => {
  it("gives ten concurrent issues ten distinct consecutive numbers", async () => {
    // Warm the pool first so the ten calls reach Postgres together instead of
    // queueing behind ten cold connection handshakes.
    const warm = await Promise.all([1, 2, 3, 4].map(() => h.pool.connect()));
    for (const client of warm) client.release();

    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const deal = await seedDeal({ value: `${i + 1}.00` });
      const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
      expect(created.ok).toBe(true);
      if (created.ok) ids.push(created.value.id);
    }
    expect(ids).toHaveLength(10);

    const results = await Promise.all(
      ids.map((id) => issueDocument(h.db, admin, id, { via: "issue" }, sig())),
    );
    for (const result of results) {
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.number).not.toBeNull();
    }
    const numbers = results.map((result) => (result.ok ? (result.value.number ?? "") : "")).sort();
    const year = new Date().getUTCFullYear();
    expect(numbers).toEqual(
      Array.from({ length: 10 }, (_, i) => formatDocNumber("Q", year, i + 1)),
    );
    expect(new Set(numbers).size).toBe(10);
  });

  it("sets an invoice due date to issue plus fourteen days and keeps the number", async () => {
    const deal = await seedDeal({ value: "250.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const issued = await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 14);
    expect(issued.value.issueDate).toBe(today);
    expect(issued.value.dueDate).toBe(due.toISOString().slice(0, 10));
    expect(issued.value.status).toBe("sent");
    expect(issued.value.sentAt).not.toBeNull();
    expect(issued.value.number).toMatch(new RegExp(`^INV-${today.slice(0, 4)}-\\d{4,}$`));

    const voided = await voidInvoice(h.db, admin, created.value.id, sig());
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.value.status).toBe("void");
    expect(voided.value.voidedAt).not.toBeNull();
    expect(voided.value.number).toBe(issued.value.number);
  });

  it("does not consume a number when a draft is deleted", async () => {
    const [before] = await h.db
      .select({ lastNumber: documentCounters.lastNumber })
      .from(documentCounters)
      .where(
        and(
          eq(documentCounters.kind, "quote"),
          eq(documentCounters.year, new Date().getUTCFullYear()),
        ),
      );
    const startingFrom = before?.lastNumber ?? 0;

    const dealA = await seedDeal({ value: "1.00" });
    const draft = await createDocument(h.db, admin, { dealId: dealA.id, kind: "quote" }, sig());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const removed = await deleteDraft(h.db, admin, draft.value.id, sig());
    expect(removed.ok).toBe(true);

    const dealB = await seedDeal({ value: "2.00" });
    const next = await createDocument(h.db, admin, { dealId: dealB.id, kind: "quote" }, sig());
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const issued = await issueDocument(h.db, admin, next.value.id, { via: "issue" }, sig());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value.number).toBe(
      formatDocNumber("Q", new Date().getUTCFullYear(), startingFrom + 1),
    );
  });

  it("refuses to delete an issued invoice with E_DOC_008 and an issued quote with E_DOC_003", async () => {
    const invoiceDeal = await seedDeal({ value: "5.00" });
    const invoice = await createDocument(
      h.db,
      admin,
      { dealId: invoiceDeal.id, kind: "invoice" },
      sig(),
    );
    expect(invoice.ok).toBe(true);
    if (!invoice.ok) return;
    const issuedInvoice = await issueDocument(
      h.db,
      admin,
      invoice.value.id,
      { via: "markSent" },
      sig(),
    );
    expect(issuedInvoice.ok).toBe(true);
    const invoiceDelete = await deleteDraft(h.db, admin, invoice.value.id, sig());
    expect(invoiceDelete.ok).toBe(false);
    if (invoiceDelete.ok) return;
    expect(invoiceDelete.error.id).toBe(ERROR_IDS.DOC_INVOICE_DELETE);

    const quoteDeal = await seedDeal({ value: "6.00" });
    const quote = await createDocument(h.db, admin, { dealId: quoteDeal.id, kind: "quote" }, sig());
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const issuedQuote = await issueDocument(h.db, admin, quote.value.id, { via: "issue" }, sig());
    expect(issuedQuote.ok).toBe(true);
    const quoteDelete = await deleteDraft(h.db, admin, quote.value.id, sig());
    expect(quoteDelete.ok).toBe(false);
    if (quoteDelete.ok) return;
    expect(quoteDelete.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });

  it("refuses to void a draft invoice or void a quote", async () => {
    const deal = await seedDeal({ value: "7.00" });
    const draft = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const draftVoid = await voidInvoice(h.db, admin, draft.value.id, sig());
    expect(draftVoid.ok).toBe(false);
    if (draftVoid.ok) return;
    expect(draftVoid.error.id).toBe(ERROR_IDS.DOC_TRANSITION);

    const quoteDeal = await seedDeal({ value: "8.00" });
    const quote = await createDocument(h.db, admin, { dealId: quoteDeal.id, kind: "quote" }, sig());
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const quoteVoid = await voidInvoice(h.db, admin, quote.value.id, sig());
    expect(quoteVoid.ok).toBe(false);
    if (quoteVoid.ok) return;
    expect(quoteVoid.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });
});

describe("payments", () => {
  it("marks an invoice paid when two payments reach the total", async () => {
    const deal = await seedDeal({ value: "1000.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const issued = await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
    expect(issued.ok).toBe(true);

    const first = await recordPayment(
      h.db,
      admin,
      {
        documentId: created.value.id,
        amount: "400.00",
        paidOn: "2026-10-01",
        method: "bank_transfer",
      },
      sig(),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("sent");
    expect(first.value.outstanding).toBe("600.00");
    expect(first.value.payments).toHaveLength(1);

    const second = await recordPayment(
      h.db,
      admin,
      { documentId: created.value.id, amount: "600.00", paidOn: "2026-10-02", method: "card" },
      sig(),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.status).toBe("paid");
    expect(second.value.paidAt).not.toBeNull();
    expect(second.value.outstanding).toBe("0.00");
  });

  it("refuses a payment above the outstanding amount with E_DOC_007", async () => {
    const deal = await seedDeal({ value: "500.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
    const first = await recordPayment(
      h.db,
      admin,
      { documentId: created.value.id, amount: "300.00", paidOn: "2026-10-01", method: "cash" },
      sig(),
    );
    expect(first.ok).toBe(true);

    const tooMuch = await recordPayment(
      h.db,
      admin,
      { documentId: created.value.id, amount: "300.00", paidOn: "2026-10-02", method: "cash" },
      sig(),
    );
    expect(tooMuch.ok).toBe(false);
    if (tooMuch.ok) return;
    expect(tooMuch.error.id).toBe(ERROR_IDS.DOC_OVERPAYMENT);
  });

  it("returns a past-due paid invoice to overdue when its payment is deleted", async () => {
    const deal = await seedDeal({ value: "100.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
    await h.db
      .update(documents)
      .set({ dueDate: "2020-01-01" })
      .where(eq(documents.id, created.value.id));

    const paid = await recordPayment(
      h.db,
      admin,
      { documentId: created.value.id, amount: "100.00", paidOn: "2026-10-01", method: "card" },
      sig(),
    );
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.value.status).toBe("paid");
    const paymentId = paid.value.payments[0]?.id ?? "";

    const removed = await deletePayment(h.db, admin, paymentId, sig());
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.status).toBe("overdue");
    expect(removed.value.paidAt).toBeNull();
    expect(removed.value.outstanding).toBe("100.00");
  });

  it("refuses a payment on a draft or a quote", async () => {
    const deal = await seedDeal({ value: "10.00" });
    const draft = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const draftPay = await recordPayment(
      h.db,
      admin,
      { documentId: draft.value.id, amount: "1.00", paidOn: "2026-10-01", method: "cash" },
      sig(),
    );
    expect(draftPay.ok).toBe(false);
    if (draftPay.ok) return;
    expect(draftPay.error.id).toBe(ERROR_IDS.DOC_TRANSITION);

    const quoteDeal = await seedDeal({ value: "20.00" });
    const quote = await createDocument(h.db, admin, { dealId: quoteDeal.id, kind: "quote" }, sig());
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    await issueDocument(h.db, admin, quote.value.id, { via: "issue" }, sig());
    const quotePay = await recordPayment(
      h.db,
      admin,
      { documentId: quote.value.id, amount: "1.00", paidOn: "2026-10-01", method: "cash" },
      sig(),
    );
    expect(quotePay.ok).toBe(false);
    if (quotePay.ok) return;
    expect(quotePay.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });
});

describe("the overdue job", () => {
  it("marks only sent invoices past due", async () => {
    async function issuedInvoice(value: string): Promise<string> {
      const deal = await seedDeal({ value });
      const created = await createDocument(
        h.db,
        admin,
        { dealId: deal.id, kind: "invoice" },
        sig(),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return "";
      const issued = await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
      expect(issued.ok).toBe(true);
      return created.value.id;
    }

    const pastDueId = await issuedInvoice("10.00");
    await h.db.update(documents).set({ dueDate: "2020-01-01" }).where(eq(documents.id, pastDueId));

    const paidId = await issuedInvoice("20.00");
    await h.db.update(documents).set({ dueDate: "2020-01-01" }).where(eq(documents.id, paidId));
    await recordPayment(
      h.db,
      admin,
      { documentId: paidId, amount: "20.00", paidOn: "2026-10-01", method: "card" },
      sig(),
    );

    const futureId = await issuedInvoice("30.00");

    const quoteDeal = await seedDeal({ value: "40.00" });
    const quote = await createDocument(h.db, admin, { dealId: quoteDeal.id, kind: "quote" }, sig());
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    await issueDocument(h.db, admin, quote.value.id, { via: "issue" }, sig());
    await h.db
      .update(documents)
      .set({ validUntil: "2020-01-01" })
      .where(eq(documents.id, quote.value.id));

    const marked = await runOverdueInvoices(h.db, sig());
    expect(marked).toBe(1);

    const read = async (id: string): Promise<string | undefined> => {
      const [row] = await h.db
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, id));
      return row?.status;
    };
    expect(await read(pastDueId)).toBe("overdue");
    expect(await read(paidId)).toBe("paid");
    expect(await read(futureId)).toBe("sent");
    expect(await read(quote.value.id)).toBe("sent");
  });
});

describe("sending", () => {
  const MAIL_ADDRESS = "docs-owner@example.com";
  let mailDir = "";
  let mailboxId = "";

  beforeAll(async () => {
    mailDir = mkdtempSync(join(tmpdir(), "dfdocs-"));
    const owner = await hydrateActor(h.db, admin.id, sig());
    if (owner === null) throw new Error("admin actor fixture failed");
    const connected = await connectImapMailbox(
      h.db,
      owner,
      { emailAddress: MAIL_ADDRESS, password: "fake-app-password-1", preset: "purelymail" },
      { transports: createFakeTransportFactory(mailDir), enqueueSync: () => Promise.resolve() },
      sig(),
    );
    if (!connected.ok) throw new Error(`mailbox fixture failed: ${connected.error.id}`);
    mailboxId = connected.value.accountId;
  }, 60_000);

  afterAll(() => {
    if (mailDir !== "") rmSync(mailDir, { recursive: true, force: true });
  });

  function deps() {
    return {
      resolveDeps: { transports: createFakeTransportFactory(mailDir) },
      storage: new FakeStorageClient(),
    };
  }

  it("issues a draft, delivers one message with the public link and links it to the deal", async () => {
    const deal = await seedDeal({ value: "100.00" });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.customerEmail).toBe("ada@example.com");

    const sent = await sendDocument(h.db, admin, { id: created.value.id }, sig(), deps());
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.status).toBe("sent");
    expect(sent.value.number).not.toBeNull();
    expect(sent.value.sentAt).not.toBeNull();

    const wire = fakeRead(mailDir, MAIL_ADDRESS, "Sent", 1).toString("utf8");
    expect(wire).toContain(`Subject: Quote ${sent.value.number ?? "MISSING"} from`);
    // The HTML part is base64 on the wire; decode it to read the link.
    const splitAt = wire.indexOf("\r\n\r\n");
    const decoded = Buffer.from(wire.slice(splitAt + 4).trim(), "base64").toString("utf8");
    expect(decoded).toContain(sent.value.publicUrl);
    expect(decoded).toContain("Hi Ada");

    const messages = await h.db.execute(
      sql`SELECT count(*)::int AS count FROM email_messages WHERE account_id=${mailboxId}`,
    );
    expect(messages.rows[0]).toEqual({ count: 1 });
    const threads = await h.db.execute(
      sql`SELECT deal_id FROM email_threads WHERE account_id=${mailboxId}`,
    );
    expect(threads.rows[0]).toEqual({ deal_id: deal.id });

    // Send again: no transition, the same number, a second message.
    const again = await sendDocument(h.db, admin, { id: created.value.id }, sig(), deps());
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.number).toBe(sent.value.number);
    expect(again.value.status).toBe("sent");
    const second = await h.db.execute(
      sql`SELECT count(*)::int AS count FROM email_messages WHERE account_id=${mailboxId}`,
    );
    expect(second.rows[0]).toEqual({ count: 2 });
  });

  it("refuses a document with no customer email with E_DOC_005 and leaves it draft", async () => {
    const deal = await seedDeal({ value: "10.00", withContact: false });
    const created = await createDocument(h.db, admin, { dealId: deal.id, kind: "invoice" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await sendDocument(h.db, admin, { id: created.value.id }, sig(), deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.DOC_NO_CUSTOMER_EMAIL);
    const read = await getDocument(h.db, admin, created.value.id, sig());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.status).toBe("draft");
  });

  it("refuses a sender with no connected mailbox with E_DOC_006 and leaves it draft", async () => {
    const deal = await seedDeal({ value: "20.00", ownerId: regular.id });
    const created = await createDocument(h.db, regular, { dealId: deal.id, kind: "quote" }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await sendDocument(h.db, regular, { id: created.value.id }, sig(), deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.DOC_NO_MAILBOX);
    const read = await getDocument(h.db, regular, created.value.id, sig());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.status).toBe("draft");
  });
});

describe("loadDocumentsList", () => {
  it("lists only visible documents and totals outstanding in the base currency", async () => {
    // The total is global, so this case starts from an empty documents table.
    await h.db.delete(documents);
    const visibleDeal = await seedDeal({ value: "1000.00" });
    const invoice = await createDocument(
      h.db,
      admin,
      { dealId: visibleDeal.id, kind: "invoice" },
      sig(),
    );
    expect(invoice.ok).toBe(true);
    if (!invoice.ok) return;
    await issueDocument(h.db, admin, invoice.value.id, { via: "issue" }, sig());
    await recordPayment(
      h.db,
      admin,
      { documentId: invoice.value.id, amount: "400.00", paidOn: "2026-10-01", method: "card" },
      sig(),
    );

    const hiddenDeal = await seedDeal({ value: "500.00", visibility: "owner", ownerId: admin.id });
    const hidden = await createDocument(
      h.db,
      admin,
      { dealId: hiddenDeal.id, kind: "invoice" },
      sig(),
    );
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    await issueDocument(h.db, admin, hidden.value.id, { via: "issue" }, sig());

    const jpyDeal = await seedDeal({ value: "5000.00" });
    await setDealTerms(h.db, admin, { dealId: jpyDeal.id, currency: "JPY" }, sig());
    const jpy = await createDocument(h.db, admin, { dealId: jpyDeal.id, kind: "invoice" }, sig());
    expect(jpy.ok).toBe(true);
    if (!jpy.ok) return;
    await issueDocument(h.db, admin, jpy.value.id, { via: "issue" }, sig());

    // A quote never counts toward outstanding.
    const quote = await createDocument(
      h.db,
      admin,
      { dealId: visibleDeal.id, kind: "quote" },
      sig(),
    );
    expect(quote.ok).toBe(true);

    const adminList = await loadDocumentsList(h.db, admin, sig());
    expect(adminList.ok).toBe(true);
    if (!adminList.ok) return;
    expect(adminList.value.base).toBe("USD");
    expect(adminList.value.outstandingTotal).toBe("1100.00");
    expect(adminList.value.excludedCurrencies).toEqual(["JPY"]);
    expect(adminList.value.rows.map((row) => row.id)).toContain(hidden.value.id);

    const regularList = await loadDocumentsList(h.db, regular, sig());
    expect(regularList.ok).toBe(true);
    if (!regularList.ok) return;
    expect(regularList.value.outstandingTotal).toBe("600.00");
    expect(regularList.value.excludedCurrencies).toEqual(["JPY"]);
    const regularIds = regularList.value.rows.map((row) => row.id);
    expect(regularIds).not.toContain(hidden.value.id);
    expect(regularIds).toContain(invoice.value.id);
    expect(regularIds).toContain(jpy.value.id);
  });
});
