import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { changeLogs, dealProducts, deals, products } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { type ChangeLogEntry, listChangeLog } from "@/features/collaboration/changeLog";
import { saveRate } from "@/features/currency/rates";
import { updateDeal } from "@/features/deals/dealActions";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { addDealLine, removeDealLine, updateDealLine } from "./dealProducts";
import { createProduct, deleteProduct } from "./products";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let regular: PermSetUser;
let pipelineId: string;
let stageId: string;
let usdProductId: string;
let eurProductId: string;
let jpyProductId: string;

const sig = (): AbortSignal => AbortSignal.timeout(10_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true });
  const regularRow = await seedUser(h.db);
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
    {
      name: "Consulting",
      code: "CONSULT",
      price: "1200.00",
      currency: "USD",
      taxPercent: "20",
    },
    sig(),
  );
  const eur = await createProduct(
    h.db,
    admin,
    { name: "Euro widget", code: "WIDGET", price: "100.00", currency: "EUR", taxPercent: "0" },
    sig(),
  );
  const jpy = await createProduct(
    h.db,
    admin,
    { name: "Yen item", code: "YEN", price: "500", currency: "JPY", taxPercent: "0" },
    sig(),
  );
  usdProductId = usd.ok ? usd.value.id : "";
  eurProductId = eur.ok ? eur.value.id : "";
  jpyProductId = jpy.ok ? jpy.value.id : "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(dealProducts);
  await h.db.delete(changeLogs);
  await h.db.delete(deals);
});

async function seedDeal(value: string | null = null): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Test deal",
      pipelineId,
      stageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
      value,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "seedDeal failed");
  return row;
}

async function readDealValue(dealId: string): Promise<string | null> {
  const [row] = await h.db.select({ value: deals.value }).from(deals).where(eq(deals.id, dealId));
  return row?.value ?? null;
}

async function lines(dealId: string): Promise<Array<typeof dealProducts.$inferSelect>> {
  return h.db.select().from(dealProducts).where(eq(dealProducts.dealId, dealId));
}

async function valueChanges(dealId: string): Promise<ChangeLogEntry[]> {
  const entries = await listChangeLog(h.db, "deal", dealId, sig());
  return entries.filter((entry) => entry.field === "value");
}

describe("addDealLine", () => {
  it("writes the line, sets the deal value to the net total and logs one change", async () => {
    const deal = await seedDeal();
    const result = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: usdProductId, quantity: "2", discountPercent: "10" },
      sig(),
    );
    expect(result.ok).toBe(true);
    expect(await readDealValue(deal.id)).toBe("2160.00");
    const changes = await valueChanges(deal.id);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.oldValue).toBeNull();
    expect(changes[0]?.newValue).toBe("2160.00");
  });

  it("defaults quantity to 1 and tax to the product tax", async () => {
    const deal = await seedDeal();
    const result = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: usdProductId },
      sig(),
    );
    expect(result.ok).toBe(true);
    const rows = await lines(deal.id);
    expect(rows[0]?.quantity).toBe("1.000");
    expect(rows[0]?.taxPercent).toBe("20.00");
    expect(await readDealValue(deal.id)).toBe("1200.00");
  });

  it("converts a product priced in another currency at add time", async () => {
    const deal = await seedDeal();
    const result = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: eurProductId },
      sig(),
    );
    expect(result.ok).toBe(true);
    const rows = await lines(deal.id);
    expect(rows[0]?.itemPrice).toBe("108.00");
    expect(await readDealValue(deal.id)).toBe("108.00");
  });

  it("refuses a product whose currency has no rate and writes nothing", async () => {
    const deal = await seedDeal("50.00");
    const result = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: jpyProductId },
      sig(),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_RATE_MISSING);
    expect(await lines(deal.id)).toHaveLength(0);
    expect(await readDealValue(deal.id)).toBe("50.00");
    expect(await valueChanges(deal.id)).toHaveLength(0);
  });

  it("refuses an archived or missing product", async () => {
    const deal = await seedDeal();
    const result = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: jpyProductId },
      sig(),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_RATE_MISSING);
    const archived = await h.db
      .update(products)
      .set({ active: false })
      .where(eq(products.id, jpyProductId))
      .returning();
    expect(archived).toHaveLength(1);
    const second = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: jpyProductId },
      sig(),
    );
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error.id).toBe(ERROR_IDS.PRODUCT_NOT_FOUND);
  });

  it("refuses a caller without edit rights on the deal", async () => {
    const deal = await seedDeal();
    const result = await addDealLine(
      h.db,
      regular,
      { dealId: deal.id, productId: usdProductId },
      sig(),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PERM_DENIED);
    expect(await lines(deal.id)).toHaveLength(0);
  });
});

describe("updateDealLine and removeDealLine", () => {
  it("follows the value when a line is edited", async () => {
    const deal = await seedDeal();
    const added = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: usdProductId, quantity: "2", discountPercent: "10" },
      sig(),
    );
    expect(added.ok).toBe(true);
    const lineId = added.ok ? added.value.line.id : "";
    const updated = await updateDealLine(h.db, admin, { lineId, quantity: "1" }, sig());
    expect(updated.ok).toBe(true);
    expect(await readDealValue(deal.id)).toBe("1080.00");
  });

  it("follows the value while lines remain and keeps the last total when the last is removed", async () => {
    const deal = await seedDeal();
    const first = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: usdProductId },
      sig(),
    );
    const second = await addDealLine(
      h.db,
      admin,
      { dealId: deal.id, productId: eurProductId },
      sig(),
    );
    expect(first.ok && second.ok).toBe(true);
    const firstId = first.ok ? first.value.line.id : "";
    const secondId = second.ok ? second.value.line.id : "";
    expect(await readDealValue(deal.id)).toBe("1308.00");

    const removed = await removeDealLine(h.db, admin, { lineId: firstId }, sig());
    expect(removed.ok).toBe(true);
    expect(await readDealValue(deal.id)).toBe("108.00");

    const last = await removeDealLine(h.db, admin, { lineId: secondId }, sig());
    expect(last.ok).toBe(true);
    expect(await lines(deal.id)).toHaveLength(0);
    expect(await readDealValue(deal.id)).toBe("108.00");
  });

  it("refuses a missing line", async () => {
    const result = await updateDealLine(
      h.db,
      admin,
      { lineId: "00000000-0000-0000-0000-000000000000", quantity: "2" },
      sig(),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PRODUCT_LINE_NOT_FOUND);
  });
});

describe("the value is owned by the lines", () => {
  it("refuses a manual value edit while lines exist", async () => {
    const deal = await seedDeal();
    await addDealLine(h.db, admin, { dealId: deal.id, productId: usdProductId }, sig());
    const [current] = await h.db.select().from(deals).where(eq(deals.id, deal.id));
    const result = await updateDeal(
      h.db,
      admin,
      {
        dealId: deal.id,
        expectedUpdatedAt: current?.updatedAt.toISOString() ?? "",
        value: 1,
      },
      sig(),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PRODUCT_VALUE_CALCULATED);
    expect(await readDealValue(deal.id)).toBe("1200.00");
  });

  it("still allows a manual value edit when the deal has no lines", async () => {
    const deal = await seedDeal();
    const [current] = await h.db.select().from(deals).where(eq(deals.id, deal.id));
    const result = await updateDeal(
      h.db,
      admin,
      {
        dealId: deal.id,
        expectedUpdatedAt: current?.updatedAt.toISOString() ?? "",
        value: 42,
      },
      sig(),
    );
    expect(result.ok).toBe(true);
    expect(await readDealValue(deal.id)).toBe("42.00");
  });

  it("refuses deleting a product used on a deal", async () => {
    const deal = await seedDeal();
    await addDealLine(h.db, admin, { dealId: deal.id, productId: usdProductId }, sig());
    const result = await deleteProduct(h.db, admin, { id: usdProductId }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PRODUCT_IN_USE);
  });
});
