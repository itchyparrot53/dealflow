// Template variables are flat "group.key" strings. Rendering happens in two
// passes: creation substitutes everything except document.* (whose values can
// still change until issue), and the display pass fills document.* in.

import { formatMoney, parseCents } from "@/features/currency/money";

export type VarContext = Record<string, string>;

const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
// The products marker is a block in markdownLite, never a variable.
const PRODUCTS_KEY = "products";

export function renderVariables(
  src: string,
  ctx: VarContext,
  opts: { keepPrefix?: string } = {},
): string {
  return src.replace(VARIABLE, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (key === PRODUCTS_KEY) return match;
    if (opts.keepPrefix !== undefined && key.startsWith(opts.keepPrefix)) return match;
    return ctx[key] ?? "";
  });
}

// The display pass: everything about the document is settled once it is issued,
// so document.* can be filled in when the page renders.
export interface DisplayDocument {
  title: string;
  number: string | null;
  total: string;
  currency: string;
  validUntil: string | null;
  dueDate: string | null;
  issueDate: string | null;
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

function longDate(value: string | null): string {
  if (value === null) return "";
  return LONG_DATE.format(new Date(`${value}T00:00:00Z`));
}

export function documentVariableContext(doc: DisplayDocument): VarContext {
  return {
    "document.title": doc.title,
    "document.number": doc.number ?? "",
    "document.total": formatMoney(parseCents(doc.total), doc.currency),
    "document.valid_until": longDate(doc.validUntil),
    "document.due_date": longDate(doc.dueDate),
    "document.issue_date": longDate(doc.issueDate),
  };
}

export function renderDocumentBody(body: string, doc: DisplayDocument): string {
  return renderVariables(body, documentVariableContext(doc));
}
