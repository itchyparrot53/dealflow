import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  dealProducts,
  deals,
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
import type { PermSetUser } from "@/features/permissions/effective";
import { addDealLine } from "@/features/products/dealProducts";
import { setDealTerms } from "@/features/products/dealTerms";
import { createProduct } from "@/features/products/products";
import { makeTestDb } from "@/test/db";
import {
  createDocument,
  deleteDraft,
  duplicateDocument,
  getDocument,
  listDocumentsForDeal,
  refreshLines,
  updateDraft,
} from "./documents";
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
    flags: new Set(),
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
