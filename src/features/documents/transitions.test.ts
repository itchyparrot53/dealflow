import { describe, expect, it } from "vitest";
import { type DocEvent, type DocKind, type DocStatus, nextStatus } from "./transitions";

// Every allowed transition of Plan section 6.6, then the refused ones the plan
// calls out explicitly. A table keeps the contract and the coverage in one place.
const cases: [DocKind, DocStatus, DocEvent, DocStatus | null][] = [
  // quote: draft issues, either through "issue" or through "markSent".
  ["quote", "draft", "issue", "sent"],
  ["quote", "draft", "markSent", "sent"],
  // quote: viewing is idempotent while sent or viewed.
  ["quote", "sent", "view", "viewed"],
  ["quote", "viewed", "view", "viewed"],
  // quote: accept and decline from sent or viewed.
  ["quote", "sent", "accept", "accepted"],
  ["quote", "viewed", "accept", "accepted"],
  ["quote", "sent", "decline", "declined"],
  ["quote", "viewed", "decline", "declined"],
  // invoice: draft issues.
  ["invoice", "draft", "issue", "sent"],
  ["invoice", "draft", "markSent", "sent"],
  // invoice: a view only records the timestamp, the status is unchanged.
  ["invoice", "sent", "view", "sent"],
  ["invoice", "overdue", "view", "overdue"],
  ["invoice", "sent", "overdue", "overdue"],
  ["invoice", "sent", "pay", "paid"],
  ["invoice", "overdue", "pay", "paid"],
  ["invoice", "paid", "unpay", "sent"],
  ["invoice", "sent", "void", "void"],
  ["invoice", "overdue", "void", "void"],

  // Refused: the plan lists these causes, and they must never move status.
  ["quote", "draft", "accept", null],
  ["quote", "sent", "pay", null],
  ["quote", "sent", "void", null],
  ["quote", "draft", "void", null],
  ["quote", "draft", "view", null],
  ["quote", "sent", "issue", null],
  ["quote", "declined", "decline", null],
  ["quote", "accepted", "decline", null],
  ["invoice", "paid", "void", null],
  ["invoice", "paid", "pay", null],
  ["invoice", "draft", "view", null],
  ["invoice", "draft", "overdue", null],
  ["invoice", "draft", "accept", null],
  ["invoice", "void", "void", null],
  ["invoice", "sent", "unpay", null],
];

describe("nextStatus", () => {
  it.each(cases)("%s from %s on %s gives %s", (kind, from, event, want) => {
    expect(nextStatus(kind, from, event)).toBe(want);
  });

  it("never moves a quote to an invoice-only status", () => {
    const invoiceOnly: DocEvent[] = ["overdue", "pay", "unpay"];
    for (const event of invoiceOnly) {
      expect(nextStatus("quote", "sent", event)).toBeNull();
    }
  });

  it("returns null for a status the kind can never reach", () => {
    expect(nextStatus("invoice", "accepted", "pay")).toBeNull();
    expect(nextStatus("invoice", "declined", "pay")).toBeNull();
    expect(nextStatus("quote", "paid", "unpay")).toBeNull();
    expect(nextStatus("quote", "overdue", "pay")).toBeNull();
  });
});
