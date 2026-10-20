import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { deals, documents, organizations, persons } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { createDocument } from "./documents";
import { issueDocument, voidInvoice } from "./issue";
import { acceptQuote, declineQuote, getPublicDocument } from "./publicDocuments";
import { checkPublicRateLimit, resetPublicRateLimitForTest } from "./publicRateLimit";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let pipelineId: string;
let stageId: string;
let personId: string;
let orgId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);
const IP = "203.0.113.5";

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true, name: "Admin User" });
  admin = { id: adminRow.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
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
    .values({ name: "Analytical Engines", ownerId: admin.id, visibilityLevel: "all" })
    .returning();
  personId = person?.id ?? "";
  orgId = org?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(() => {
  resetPublicRateLimitForTest();
});

async function seedDeal(): Promise<string> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Big deal",
      pipelineId,
      stageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
      personId,
      orgId,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "seedDeal failed");
  return row.id;
}

async function issued(kind: "quote" | "invoice"): Promise<{ id: string; publicId: string }> {
  const dealId = await seedDeal();
  const created = await createDocument(h.db, admin, { dealId, kind }, sig());
  if (!created.ok) throw new Error(`createDocument failed: ${created.error.id}`);
  const issuedDoc = await issueDocument(h.db, admin, created.value.id, { via: "issue" }, sig());
  if (!issuedDoc.ok) throw new Error(`issueDocument failed: ${issuedDoc.error.id}`);
  return { id: created.value.id, publicId: created.value.publicId };
}

async function readRow(id: string): Promise<typeof documents.$inferSelect | undefined> {
  const [row] = await h.db.select().from(documents).where(eq(documents.id, id));
  return row;
}

describe("getPublicDocument", () => {
  it("hides a draft and a void document with E_DOC_001", async () => {
    const dealId = await seedDeal();
    const draft = await createDocument(h.db, admin, { dealId, kind: "quote" }, sig());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const draftRead = await getPublicDocument(h.db, draft.value.publicId, { ip: IP }, sig());
    expect(draftRead.ok).toBe(false);
    if (draftRead.ok) return;
    expect(draftRead.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);

    const invoice = await issued("invoice");
    const voided = await voidInvoice(h.db, admin, invoice.id, sig());
    expect(voided.ok).toBe(true);
    const voidRead = await getPublicDocument(h.db, invoice.publicId, { ip: IP }, sig());
    expect(voidRead.ok).toBe(false);
    if (voidRead.ok) return;
    expect(voidRead.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);

    const unknown = await getPublicDocument(h.db, "not-a-real-public-id", { ip: IP }, sig());
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);
  });

  it("records the first view of a sent quote once", async () => {
    const quote = await issued("quote");
    const first = await getPublicDocument(h.db, quote.publicId, { ip: IP }, sig());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("viewed");
    const viewedAt = (await readRow(quote.id))?.viewedAt?.toISOString();
    expect(viewedAt).toBeDefined();

    const second = await getPublicDocument(h.db, quote.publicId, { ip: IP }, sig());
    expect(second.ok).toBe(true);
    expect((await readRow(quote.id))?.viewedAt?.toISOString()).toBe(viewedAt);
  });

  it("records viewed_at on an invoice without changing its status", async () => {
    const invoice = await issued("invoice");
    const first = await getPublicDocument(h.db, invoice.publicId, { ip: IP }, sig());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("sent");
    const row = await readRow(invoice.id);
    expect(row?.status).toBe("sent");
    expect(row?.viewedAt).not.toBeNull();

    const viewedAt = row?.viewedAt?.toISOString();
    await getPublicDocument(h.db, invoice.publicId, { ip: IP }, sig());
    expect((await readRow(invoice.id))?.viewedAt?.toISOString()).toBe(viewedAt);
  });

  it("returns the document without customer email or internal ids", async () => {
    const quote = await issued("quote");
    const result = await getPublicDocument(h.db, quote.publicId, { ip: IP }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.customerName).toBe("Ada Lovelace");
    expect(result.value.acceptedName).toBeNull();
    expect(JSON.stringify(result.value)).not.toContain("ada@example.com");
    expect(result.value.company.name).toBeNull();
  });

  it("hides a quote of a soft-deleted deal but keeps an issued invoice visible", async () => {
    const quoteDeal = await seedDeal();
    const quoteCreated = await createDocument(
      h.db,
      admin,
      { dealId: quoteDeal, kind: "quote" },
      sig(),
    );
    expect(quoteCreated.ok).toBe(true);
    if (!quoteCreated.ok) return;
    await issueDocument(h.db, admin, quoteCreated.value.id, { via: "issue" }, sig());
    await h.db.update(deals).set({ deletedAt: new Date() }).where(eq(deals.id, quoteDeal));
    const hidden = await getPublicDocument(h.db, quoteCreated.value.publicId, { ip: IP }, sig());
    expect(hidden.ok).toBe(false);
    if (hidden.ok) return;
    expect(hidden.error.id).toBe(ERROR_IDS.DOC_NOT_FOUND);

    const invoice = await issued("invoice");
    const [invoiceRow] = await h.db
      .select({ dealId: documents.dealId })
      .from(documents)
      .where(eq(documents.id, invoice.id));
    await h.db
      .update(deals)
      .set({ deletedAt: new Date() })
      .where(eq(deals.id, invoiceRow?.dealId ?? ""));
    const visible = await getPublicDocument(h.db, invoice.publicId, { ip: IP }, sig());
    expect(visible.ok).toBe(true);
  });

  it("renders document.* variables in the public body", async () => {
    const invoice = await issued("invoice");
    const result = await getPublicDocument(h.db, invoice.publicId, { ip: IP }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).not.toContain("{{document.number}}");
    const row = await readRow(invoice.id);
    if (row?.number !== null && row?.number !== undefined) {
      expect(result.value.body).toContain(row.number);
    }
    expect(result.value.body).not.toContain("{{document.");
    // The products block marker is left for the renderer on purpose.
    expect(result.value.body).toContain("{{products}}");
  });
});

describe("acceptQuote", () => {
  it("stores the name, time and IP and moves the quote to accepted", async () => {
    const quote = await issued("quote");
    const accepted = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Jamie Rivera", agree: true, ip: "198.51.100.9" },
      sig(),
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.status).toBe("accepted");
    expect(accepted.value.acceptedName).toBe("Jamie Rivera");
    const row = await readRow(quote.id);
    expect(row?.status).toBe("accepted");
    expect(row?.acceptedAt).not.toBeNull();
    expect(row?.acceptedIp).toBe("198.51.100.9");
  });

  it("refuses a second accept or a decline after accept with E_DOC_003", async () => {
    const quote = await issued("quote");
    const first = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Jamie Rivera", agree: true, ip: IP },
      sig(),
    );
    expect(first.ok).toBe(true);
    const second = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Someone Else", agree: true, ip: IP },
      sig(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.id).toBe(ERROR_IDS.DOC_TRANSITION);

    const declined = await declineQuote(h.db, quote.publicId, { reason: "Changed my mind" }, sig());
    expect(declined.ok).toBe(false);
    if (declined.ok) return;
    expect(declined.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });

  it("refuses accept and decline after valid_until with E_DOC_004", async () => {
    const quote = await issued("quote");
    await h.db
      .update(documents)
      .set({ validUntil: "2020-01-01" })
      .where(eq(documents.id, quote.id));
    const accepted = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Jamie Rivera", agree: true, ip: IP },
      sig(),
    );
    expect(accepted.ok).toBe(false);
    if (accepted.ok) return;
    expect(accepted.error.id).toBe(ERROR_IDS.DOC_EXPIRED);
    expect((await readRow(quote.id))?.status).toBe("sent");

    const declined = await declineQuote(h.db, quote.publicId, { reason: "Too late" }, sig());
    expect(declined.ok).toBe(false);
    if (declined.ok) return;
    expect(declined.error.id).toBe(ERROR_IDS.DOC_EXPIRED);
  });

  it("refuses an accept without agreement or with an empty name", async () => {
    const quote = await issued("quote");
    const noAgree = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Jamie Rivera", agree: false, ip: IP },
      sig(),
    );
    expect(noAgree.ok).toBe(false);
    if (noAgree.ok) return;
    expect(noAgree.error.id).toBe(ERROR_IDS.DOC_INPUT_INVALID);

    const noName = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "  ", agree: true, ip: IP },
      sig(),
    );
    expect(noName.ok).toBe(false);
    if (noName.ok) return;
    expect(noName.error.id).toBe(ERROR_IDS.DOC_INPUT_INVALID);
  });

  it("refuses to accept an invoice", async () => {
    const invoice = await issued("invoice");
    const accepted = await acceptQuote(
      h.db,
      invoice.publicId,
      { name: "Jamie Rivera", agree: true, ip: IP },
      sig(),
    );
    expect(accepted.ok).toBe(false);
    if (accepted.ok) return;
    expect(accepted.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });
});

describe("declineQuote", () => {
  it("stores the reason and moves the quote to declined", async () => {
    const quote = await issued("quote");
    const declined = await declineQuote(h.db, quote.publicId, { reason: "Price too high" }, sig());
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.value.status).toBe("declined");
    expect(declined.value.declineReason).toBe("Price too high");
    const row = await readRow(quote.id);
    expect(row?.declinedAt).not.toBeNull();
  });

  it("refuses a second decline with E_DOC_003", async () => {
    const quote = await issued("quote");
    expect((await declineQuote(h.db, quote.publicId, {}, sig())).ok).toBe(true);
    const again = await declineQuote(h.db, quote.publicId, {}, sig());
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.id).toBe(ERROR_IDS.DOC_TRANSITION);
  });
});

describe("public rate limit", () => {
  it("allows thirty requests a minute and refuses the thirty-first with E_DOC_010", () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      const result = checkPublicRateLimit("192.0.2.10", "public-id", now);
      expect(result.ok).toBe(true);
    }
    const refused = checkPublicRateLimit("192.0.2.10", "public-id", now);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.id).toBe(ERROR_IDS.DOC_RATE_LIMITED);
  });

  it("counts a shared IP across documents and a shared document across IPs", () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      expect(checkPublicRateLimit("192.0.2.11", `doc-${i}`, now).ok).toBe(true);
    }
    expect(checkPublicRateLimit("192.0.2.11", "doc-new", now).ok).toBe(false);

    resetPublicRateLimitForTest();
    for (let i = 0; i < 30; i += 1) {
      expect(checkPublicRateLimit(`ip-${i}`, "shared-doc", now).ok).toBe(true);
    }
    expect(checkPublicRateLimit("ip-new", "shared-doc", now).ok).toBe(false);
  });

  it("forgets old windows so the next minute is allowed again", () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    for (let i = 0; i < 30; i += 1) checkPublicRateLimit("192.0.2.12", "doc", now);
    expect(checkPublicRateLimit("192.0.2.12", "doc", now).ok).toBe(false);
    const later = now + 61_000;
    expect(checkPublicRateLimit("192.0.2.12", "doc", later).ok).toBe(true);
  });
});
