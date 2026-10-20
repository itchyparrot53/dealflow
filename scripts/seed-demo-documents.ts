// Part 4 demo data: document settings, the two default templates and a spread of
// quotes and invoices on the seeded deals that have product lines. Kept out of
// seed-demo.ts so both stay readable. Re-runnable: it replaces only documents whose
// title starts with "Demo: ".

import { randomBytes } from "node:crypto";
import {
  dealTotals,
  formatCents,
  lineNet,
  lineTax,
  parseBp,
  parseCents,
  parseMilli,
} from "@/features/currency/money";
import { formatDocNumber } from "@/features/documents/numbering";
import { renderVariables } from "@/features/documents/variables";
import type { Db } from "./seed-smoke-phase5-infra";

const TITLE_PREFIX = "Demo: ";

const DEFAULT_BODIES = {
  quote: [
    "# Quote {{document.number}} for {{organization.name}}",
    "Prepared for {{person.name}} by {{owner.name}}, {{company.name}}.",
    "## Summary",
    "{{deal.title}}",
    "{{products}}",
  ].join("\n"),
  invoice:
    "# Invoice {{document.number}}\nBilled to {{person.name}}, {{organization.name}}.\n{{products}}",
} as const;

const DEFAULT_TERMS = {
  quote: "This quote is valid until {{document.valid_until}}.",
  invoice: "Payment is due by {{document.due_date}}.",
} as const;

interface DocumentsArgs {
  pipelineId: string;
  ownerId: string;
}

type SettingsRow = {
  quotePrefix: string;
  invoicePrefix: string;
  quoteValidDays: number;
  invoiceDueDays: number;
  companyName: string | null;
};

type TemplateRow = {
  id: string;
  body: string;
  terms: string | null;
  includeProducts: boolean;
};

interface SnapshotLine {
  position: number;
  name: string;
  unit: string | null;
  quantity: string;
  itemPrice: string;
  discountPercent: string;
  taxPercent: string;
  net: string;
  tax: string;
  gross: string;
}

interface Snapshot {
  lines: SnapshotLine[];
  subtotal: string;
  tax: string;
  total: string;
}

type DealRef = {
  id: string;
  title: string;
  currency: string;
};

function shift(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

function addressText(address: Record<string, unknown> | null): string | null {
  if (address === null) return null;
  const parts: string[] = [];
  for (const key of ["street", "city", "region", "postal", "country"]) {
    const value = address[key];
    if (typeof value === "string" && value.trim() !== "") parts.push(value.trim());
  }
  return parts.length === 0 ? null : parts.join(", ");
}

async function seedSettings(db: Db): Promise<SettingsRow> {
  await db.q(
    `INSERT INTO document_settings
       (id, company_name, company_address, payment_instructions, footer)
     VALUES (true, 'Northwind Advisory', '1 Northwind Way, London', 
       'Bank transfer to Example Bank, account 00000000', 'Thank you for your business.')
     ON CONFLICT (id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       company_address = EXCLUDED.company_address,
       payment_instructions = EXCLUDED.payment_instructions,
       footer = EXCLUDED.footer,
       updated_at = now()`,
  );
  const [row] = await db.q<SettingsRow>(
    `SELECT quote_prefix AS "quotePrefix", invoice_prefix AS "invoicePrefix",
       quote_valid_days AS "quoteValidDays", invoice_due_days AS "invoiceDueDays",
       company_name AS "companyName"
     FROM document_settings WHERE id = true`,
  );
  return (
    row ?? {
      quotePrefix: "Q",
      invoicePrefix: "INV",
      quoteValidDays: 30,
      invoiceDueDays: 14,
      companyName: "Northwind Advisory",
    }
  );
}

async function seedTemplates(
  db: Db,
  ownerId: string,
): Promise<{ quote: TemplateRow; invoice: TemplateRow }> {
  for (const kind of ["quote", "invoice"] as const) {
    await db.q(
      `INSERT INTO document_templates (kind, name, body, terms, include_products, is_default, created_by)
       SELECT $1, $2, $3, $4, true, true, $5
       WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE kind = $1)
       ON CONFLICT DO NOTHING`,
      [
        kind,
        kind === "quote" ? "Standard quote" : "Standard invoice",
        DEFAULT_BODIES[kind],
        DEFAULT_TERMS[kind],
        ownerId,
      ],
    );
  }
  const rows = await db.q<TemplateRow & { kind: string }>(
    `SELECT DISTINCT ON (kind) id, kind, body, terms, include_products AS "includeProducts"
     FROM document_templates WHERE kind IN ('quote', 'invoice')
     ORDER BY kind, is_default DESC, created_at`,
  );
  const quote = rows.find((row) => row.kind === "quote");
  const invoice = rows.find((row) => row.kind === "invoice");
  if (quote === undefined || invoice === undefined) throw new Error("template seed failed");
  return { quote, invoice };
}

async function takeNumber(db: Db, kind: "quote" | "invoice", year: number): Promise<number> {
  const [row] = await db.q<{ lastNumber: number }>(
    `INSERT INTO document_counters (kind, year, last_number) VALUES ($1, $2, 1)
     ON CONFLICT (kind, year) DO UPDATE SET last_number = document_counters.last_number + 1
     RETURNING last_number AS "lastNumber"`,
    [kind, year],
  );
  if (row === undefined) throw new Error(`counter seed failed: ${kind}`);
  return Number(row.lastNumber);
}

async function dealSnapshot(db: Db, dealId: string): Promise<Snapshot> {
  const rows = await db.q<{
    position: number;
    name: string;
    unit: string | null;
    quantity: string;
    itemPrice: string;
    discountPercent: string;
    taxPercent: string;
  }>(
    `SELECT dp.position, p.name, p.unit, dp.quantity, dp.item_price AS "itemPrice",
       dp.discount_percent AS "discountPercent", dp.tax_percent AS "taxPercent"
     FROM deal_products dp JOIN products p ON p.id = dp.product_id
     WHERE dp.deal_id = $1 ORDER BY dp.position`,
    [dealId],
  );
  const lines: SnapshotLine[] = rows.map((row) => {
    const net = lineNet(
      parseMilli(row.quantity),
      parseCents(row.itemPrice),
      parseBp(row.discountPercent),
    );
    const tax = lineTax(net, parseBp(row.taxPercent));
    return {
      ...row,
      net: formatCents(net),
      tax: formatCents(tax),
      gross: formatCents(net + tax),
    };
  });
  const totals = dealTotals(
    rows.map((row) => ({
      qty: parseMilli(row.quantity),
      price: parseCents(row.itemPrice),
      discount: parseBp(row.discountPercent),
      tax: parseBp(row.taxPercent),
    })),
  );
  return {
    lines,
    subtotal: formatCents(totals.net),
    tax: formatCents(totals.tax),
    total: formatCents(totals.gross),
  };
}

async function customerFor(
  db: Db,
  dealId: string,
): Promise<{
  name: string | null;
  email: string | null;
  address: string | null;
  personName: string;
  firstName: string;
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  dealTitle: string;
}> {
  const [row] = await db.q<{
    dealTitle: string;
    personName: string | null;
    firstName: string | null;
    primaryEmail: string | null;
    orgName: string | null;
    address: Record<string, unknown> | null;
    ownerName: string;
    ownerEmail: string;
  }>(
    `SELECT d.title AS "dealTitle", p.name AS "personName", p.first_name AS "firstName",
       p.primary_email AS "primaryEmail", o.name AS "orgName", o.address,
       u.name AS "ownerName", u.email::text AS "ownerEmail"
     FROM deals d
     LEFT JOIN persons p ON p.id = d.person_id
     LEFT JOIN organizations o ON o.id = d.org_id
     JOIN users u ON u.id = d.owner_id
     WHERE d.id = $1`,
    [dealId],
  );
  if (row === undefined) throw new Error(`customer seed failed: ${dealId}`);
  return {
    name: row.personName ?? row.orgName,
    email: row.primaryEmail,
    address: addressText(row.address),
    personName: row.personName ?? "",
    firstName: row.firstName ?? (row.personName ?? "").split(" ")[0] ?? "",
    orgName: row.orgName ?? "",
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    dealTitle: row.dealTitle,
  };
}

async function insertLines(db: Db, documentId: string, lines: SnapshotLine[]): Promise<void> {
  for (const line of lines) {
    await db.q(
      `INSERT INTO document_lines
         (document_id, position, name, unit, quantity, item_price, discount_percent,
          tax_percent, net, tax, gross)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        documentId,
        line.position,
        line.name,
        line.unit,
        line.quantity,
        line.itemPrice,
        line.discountPercent,
        line.taxPercent,
        line.net,
        line.tax,
        line.gross,
      ],
    );
  }
}

async function insertDocument(
  db: Db,
  values: {
    kind: "quote" | "invoice";
    dealId: string;
    templateId: string;
    sourceQuoteId: string | null;
    number: string | null;
    title: string;
    body: string;
    currency: string;
    snapshot: Snapshot;
    status: string;
    customer: { name: string | null; email: string | null; address: string | null };
    issueDate: string | null;
    validUntil: string | null;
    dueDate: string | null;
    sentAt: boolean;
    viewedAt?: boolean;
    acceptedAt?: boolean;
    paidAt?: boolean;
    acceptedName?: string;
    ownerId: string;
  },
): Promise<string> {
  const [row] = await db.q<{ id: string }>(
    `INSERT INTO documents
       (kind, deal_id, template_id, source_quote_id, public_id, number, title, body, currency,
        subtotal, tax, total, status, customer_name, customer_email, customer_address,
        issue_date, valid_until, due_date, sent_at, viewed_at, accepted_at, accepted_name,
        accepted_ip, paid_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
     RETURNING id`,
    [
      values.kind,
      values.dealId,
      values.templateId,
      values.sourceQuoteId,
      randomBytes(18).toString("base64url"),
      values.number,
      values.title,
      values.body,
      values.currency,
      values.snapshot.subtotal,
      values.snapshot.tax,
      values.snapshot.total,
      values.status,
      values.customer.name,
      values.customer.email,
      values.customer.address,
      values.issueDate,
      values.validUntil,
      values.dueDate,
      values.sentAt ? new Date() : null,
      values.viewedAt === true ? new Date() : null,
      values.acceptedAt === true ? new Date() : null,
      values.acceptedName ?? null,
      values.acceptedAt === true ? "203.0.113.5" : null,
      values.paidAt === true ? new Date() : null,
      values.ownerId,
    ],
  );
  if (row === undefined) throw new Error(`document seed failed: ${values.title}`);
  return row.id;
}

function bodyFor(template: TemplateRow, ctx: Record<string, string>): string {
  const body = renderVariables(template.body, ctx, { keepPrefix: "document." });
  if (template.terms === null) return body;
  return `${body}\n\n## Terms\n${renderVariables(template.terms, ctx, { keepPrefix: "document." })}`;
}

export async function seedDocuments(
  db: Db,
  args: DocumentsArgs,
): Promise<{ documents: number; templates: number }> {
  const settings = await seedSettings(db);
  const templates = await seedTemplates(db, args.ownerId);

  // Replace only this seed's documents; a user's real documents stay untouched.
  await db.q(`DELETE FROM documents WHERE title LIKE $1`, [`${TITLE_PREFIX}%`]);

  const deals = await db.q<DealRef>(
    `SELECT d.id, d.title,
       coalesce(dt.currency, (SELECT base_currency FROM settings WHERE id = true), 'USD') AS currency
     FROM deals d
     LEFT JOIN deal_terms dt ON dt.deal_id = d.id
     WHERE d.pipeline_id = $1 AND d.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM deal_products dp WHERE dp.deal_id = d.id)
     ORDER BY d.title
     LIMIT 4`,
    [args.pipelineId],
  );
  if (deals.length === 0) return { documents: 0, templates: 2 };

  const year = currentYear();
  const quotePrefix = settings.quotePrefix;
  const invoicePrefix = settings.invoicePrefix;
  let documents = 0;

  async function makeDocument(
    deal: DealRef,
    kind: "quote" | "invoice",
    title: string,
    options: {
      status: string;
      number: boolean;
      issueDate: string | null;
      validUntil: string | null;
      dueDate: string | null;
      sentAt: boolean;
      viewedAt?: boolean;
      acceptedAt?: boolean;
      acceptedName?: string;
      paidAt?: boolean;
      sourceQuoteId?: string | null;
      snapshot?: Snapshot;
    },
  ): Promise<string> {
    const snapshot = options.snapshot ?? (await dealSnapshot(db, deal.id));
    const customer = await customerFor(db, deal.id);
    const template = kind === "quote" ? templates.quote : templates.invoice;
    const body = bodyFor(template, {
      "deal.title": customer.dealTitle,
      "deal.value": "",
      "person.name": customer.personName,
      "person.first_name": customer.firstName,
      "organization.name": customer.orgName,
      "owner.name": customer.ownerName,
      "owner.email": customer.ownerEmail,
      "company.name": settings.companyName ?? customer.ownerName,
    });
    let number: string | null = null;
    if (options.number) {
      const sequence = await takeNumber(db, kind, year);
      number = formatDocNumber(kind === "quote" ? quotePrefix : invoicePrefix, year, sequence);
    }
    const id = await insertDocument(db, {
      kind,
      dealId: deal.id,
      templateId: template.id,
      sourceQuoteId: options.sourceQuoteId ?? null,
      number,
      title: `${TITLE_PREFIX}${title}`,
      body,
      currency: deal.currency,
      snapshot,
      status: options.status,
      customer: { name: customer.name, email: customer.email, address: customer.address },
      issueDate: options.issueDate,
      validUntil: options.validUntil,
      dueDate: options.dueDate,
      sentAt: options.sentAt,
      viewedAt: options.viewedAt,
      acceptedAt: options.acceptedAt,
      acceptedName: options.acceptedName,
      paidAt: options.paidAt,
      ownerId: args.ownerId,
    });
    await insertLines(db, id, snapshot.lines);
    documents += 1;
    return id;
  }

  const at = (index: number): DealRef => deals[index % deals.length] as DealRef;

  // One draft, one sent and one accepted quote.
  await makeDocument(at(0), "quote", "draft quote", {
    status: "draft",
    number: false,
    issueDate: null,
    validUntil: shift(settings.quoteValidDays),
    dueDate: null,
    sentAt: false,
  });
  await makeDocument(at(1), "quote", "sent quote", {
    status: "sent",
    number: true,
    issueDate: shift(0),
    validUntil: shift(settings.quoteValidDays),
    dueDate: null,
    sentAt: true,
  });
  const acceptedQuote = await makeDocument(at(2), "quote", "accepted quote", {
    status: "accepted",
    number: true,
    issueDate: shift(-2),
    validUntil: shift(settings.quoteValidDays),
    dueDate: null,
    sentAt: true,
    viewedAt: true,
    acceptedAt: true,
    acceptedName: "Jamie Rivera",
  });

  // An invoice built from the accepted quote: its lines are copied verbatim.
  const quoteSnapshot = await dealSnapshot(db, at(2).id);
  await makeDocument(at(2), "invoice", "invoice from the accepted quote", {
    status: "sent",
    number: true,
    issueDate: shift(0),
    validUntil: null,
    dueDate: shift(settings.invoiceDueDays),
    sentAt: true,
    sourceQuoteId: acceptedQuote,
    snapshot: quoteSnapshot,
  });

  // A sent invoice due in the future, an overdue one, and a paid one with two payments.
  await makeDocument(at(3), "invoice", "invoice due next week", {
    status: "sent",
    number: true,
    issueDate: shift(0),
    validUntil: null,
    dueDate: shift(Math.min(settings.invoiceDueDays, 7)),
    sentAt: true,
  });
  await makeDocument(at(0), "invoice", "overdue invoice", {
    status: "overdue",
    number: true,
    issueDate: shift(-20),
    validUntil: null,
    dueDate: shift(-6),
    sentAt: true,
  });
  const paidInvoice = await makeDocument(at(1), "invoice", "paid invoice", {
    status: "paid",
    number: true,
    issueDate: shift(-10),
    validUntil: null,
    dueDate: shift(4),
    sentAt: true,
    viewedAt: true,
    paidAt: true,
  });
  const paidSnapshot = await dealSnapshot(db, at(1).id);
  const total = parseCents(paidSnapshot.total);
  const first = total / 2n;
  const second = total - first;
  if (total > 0n) {
    await db.q(
      `INSERT INTO document_payments (document_id, amount, paid_on, method, reference, recorded_by)
       VALUES ($1, $2, $3, 'bank_transfer', 'INV-PART-1', $5),
              ($1, $4, $3, 'card', 'INV-PART-2', $5)`,
      [paidInvoice, formatCents(first), shift(-3), formatCents(second), args.ownerId],
    );
  }

  return { documents, templates: 2 };
}
