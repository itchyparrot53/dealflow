import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dealProducts, documentLines, products } from "@/db/schema";
import {
  dealTotals,
  formatCents,
  lineNet,
  lineTax,
  parseBp,
  parseCents,
  parseMilli,
} from "@/features/currency/money";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// Document lines are a snapshot. Money is computed once here on integer minor
// units and stored as decimal strings; later deal edits never touch it.

export interface SnapshotLine {
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

export interface LineSnapshot {
  lines: SnapshotLine[];
  subtotal: string;
  tax: string;
  total: string;
}

export interface DocumentLineView extends SnapshotLine {
  id: string;
}

interface SourceLine {
  name: string;
  unit: string | null;
  quantity: string;
  itemPrice: string;
  discountPercent: string;
  taxPercent: string;
}

function computeLine(position: number, source: SourceLine): SnapshotLine {
  const net = lineNet(
    parseMilli(source.quantity),
    parseCents(source.itemPrice),
    parseBp(source.discountPercent),
  );
  const tax = lineTax(net, parseBp(source.taxPercent));
  return {
    position,
    name: source.name,
    unit: source.unit,
    quantity: source.quantity,
    itemPrice: source.itemPrice,
    discountPercent: source.discountPercent,
    taxPercent: source.taxPercent,
    net: formatCents(net),
    tax: formatCents(tax),
    gross: formatCents(net + tax),
  };
}

function totalsFor(lines: SnapshotLine[]): Omit<LineSnapshot, "lines"> {
  const totals = dealTotals(
    lines.map((line) => ({
      qty: parseMilli(line.quantity),
      price: parseCents(line.itemPrice),
      discount: parseBp(line.discountPercent),
      tax: parseBp(line.taxPercent),
    })),
  );
  return {
    subtotal: formatCents(totals.net),
    tax: formatCents(totals.tax),
    total: formatCents(totals.gross),
  };
}

// One value line stands in when the deal has no product lines, but only while the
// template asks for products. Without products the document carries no line.
export async function snapshotFromDeal(
  db: DbOrTx,
  input: { dealId: string; dealTitle: string; dealValue: string | null; includeProducts: boolean },
  signal: AbortSignal,
): Promise<LineSnapshot> {
  signal.throwIfAborted();
  if (!input.includeProducts) return { lines: [], subtotal: "0.00", tax: "0.00", total: "0.00" };

  const rows = await db
    .select({
      name: products.name,
      unit: products.unit,
      quantity: dealProducts.quantity,
      itemPrice: dealProducts.itemPrice,
      discountPercent: dealProducts.discountPercent,
      taxPercent: dealProducts.taxPercent,
    })
    .from(dealProducts)
    .innerJoin(products, eq(products.id, dealProducts.productId))
    .where(eq(dealProducts.dealId, input.dealId))
    .orderBy(asc(dealProducts.position));
  signal.throwIfAborted();

  if (rows.length === 0) {
    const value = input.dealValue === null ? "0" : input.dealValue;
    const line = computeLine(1, {
      name: input.dealTitle,
      unit: null,
      quantity: "1.000",
      itemPrice: formatCents(parseCents(value)),
      discountPercent: "0.00",
      taxPercent: "0.00",
    });
    return { lines: [line], ...totalsFor([line]) };
  }

  const lines = rows.map((row, index) => computeLine(index + 1, row));
  return { lines, ...totalsFor(lines) };
}

// Copy an existing document's stored lines verbatim (duplicate, invoice from quote).
export async function snapshotFromDocument(
  db: DbOrTx,
  documentId: string,
  signal: AbortSignal,
): Promise<LineSnapshot> {
  const rows = await db
    .select()
    .from(documentLines)
    .where(eq(documentLines.documentId, documentId))
    .orderBy(asc(documentLines.position));
  signal.throwIfAborted();
  const lines: SnapshotLine[] = rows.map((row) => ({
    position: row.position,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    itemPrice: row.itemPrice,
    discountPercent: row.discountPercent,
    taxPercent: row.taxPercent,
    net: row.net,
    tax: row.tax,
    gross: row.gross,
  }));
  let subtotal = 0n;
  let tax = 0n;
  for (const line of lines) {
    subtotal += parseCents(line.net);
    tax += parseCents(line.tax);
  }
  return {
    lines,
    subtotal: formatCents(subtotal),
    tax: formatCents(tax),
    total: formatCents(subtotal + tax),
  };
}

export async function replaceLines(
  tx: DbOrTx,
  documentId: string,
  snapshot: LineSnapshot,
): Promise<void> {
  await tx.delete(documentLines).where(eq(documentLines.documentId, documentId));
  if (snapshot.lines.length === 0) return;
  await tx.insert(documentLines).values(
    snapshot.lines.map((line) => ({
      documentId,
      position: line.position,
      name: line.name,
      unit: line.unit,
      quantity: line.quantity,
      itemPrice: line.itemPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      net: line.net,
      tax: line.tax,
      gross: line.gross,
    })),
  );
}

export async function readLines(
  db: Db,
  documentId: string,
  signal: AbortSignal,
): Promise<DocumentLineView[]> {
  const rows = await db
    .select()
    .from(documentLines)
    .where(eq(documentLines.documentId, documentId))
    .orderBy(asc(documentLines.position));
  signal.throwIfAborted();
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    itemPrice: row.itemPrice,
    discountPercent: row.discountPercent,
    taxPercent: row.taxPercent,
    net: row.net,
    tax: row.tax,
    gross: row.gross,
  }));
}
