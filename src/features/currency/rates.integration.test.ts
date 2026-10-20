import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { currencyRates, settings } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { deleteRate, listRates, loadRateMap, saveRate, setBaseCurrency } from "./rates";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let manager: PermSetUser;
let regular: PermSetUser;

const sig = (): AbortSignal => AbortSignal.timeout(10_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true });
  const managerRow = await seedUser(h.db);
  const regularRow = await seedUser(h.db);
  admin = {
    id: adminRow.id,
    type: "admin",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  manager = {
    id: managerRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(["permissions.manage"]),
  };
  regular = {
    id: regularRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(currencyRates);
  await h.db
    .insert(settings)
    .values({ id: true, baseCurrency: "USD" })
    .onConflictDoUpdate({ target: settings.id, set: { baseCurrency: "USD" } });
});

describe("loadRateMap", () => {
  it("reads the base currency from settings and rates from currency_rates", async () => {
    const empty = await loadRateMap(h.db, sig());
    expect(empty.base).toBe("USD");
    expect(empty.rates.size).toBe(0);

    const saved = await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    expect(saved.ok).toBe(true);

    const map = await loadRateMap(h.db, sig());
    expect(map.base).toBe("USD");
    expect(map.rates.get("EUR")).toBe(108_000_000n);
  });
});

describe("saveRate", () => {
  it("upserts a rate and exposes it through listRates", async () => {
    const first = await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    expect(first.ok).toBe(true);
    const second = await saveRate(h.db, admin, { code: "EUR", rate: "1.1" }, sig());
    expect(second.ok).toBe(true);

    const list = await listRates(h.db, sig());
    expect(list.base).toBe("USD");
    expect(list.rates.map((r) => r.code)).toEqual(["EUR"]);
    expect(list.rates[0]?.rate).toBe("1.10000000");
  });

  it("refuses a rate for the base currency", async () => {
    const result = await saveRate(h.db, admin, { code: "USD", rate: "1.5" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_BASE_RATE);
    const rows = await h.db.select().from(currencyRates).where(eq(currencyRates.code, "USD"));
    expect(rows).toHaveLength(0);
  });

  it("refuses an unknown currency code", async () => {
    const result = await saveRate(h.db, admin, { code: "ZZZ", rate: "1.5" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_UNKNOWN);
  });

  it("refuses an invalid rate string", async () => {
    const result = await saveRate(h.db, admin, { code: "EUR", rate: "nope" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_INPUT_INVALID);
  });

  it("refuses a caller without permissions.manage and writes nothing", async () => {
    const result = await saveRate(h.db, regular, { code: "EUR", rate: "1.08" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PERM_DENIED);
    expect(await h.db.select().from(currencyRates)).toHaveLength(0);
  });

  it("allows a non-admin who holds permissions.manage", async () => {
    const result = await saveRate(h.db, manager, { code: "GBP", rate: "1.27" }, sig());
    expect(result.ok).toBe(true);
  });
});

describe("deleteRate", () => {
  it("removes one code", async () => {
    await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    await saveRate(h.db, admin, { code: "GBP", rate: "1.27" }, sig());
    const removed = await deleteRate(h.db, admin, "EUR", sig());
    expect(removed.ok).toBe(true);
    const codes = (await h.db.select().from(currencyRates)).map((r) => r.code).sort();
    expect(codes).toEqual(["GBP"]);
  });

  it("refuses a caller without permissions.manage", async () => {
    await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    const removed = await deleteRate(h.db, regular, "EUR", sig());
    expect(removed.ok).toBe(false);
    expect(removed.ok === false && removed.error.id).toBe(ERROR_IDS.PERM_DENIED);
    expect(await h.db.select().from(currencyRates)).toHaveLength(1);
  });
});

describe("setBaseCurrency", () => {
  it("changes the base and clears every rate in one transaction", async () => {
    await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    await saveRate(h.db, admin, { code: "GBP", rate: "1.27" }, sig());

    const result = await setBaseCurrency(h.db, admin, { code: "EUR" }, sig());
    expect(result.ok).toBe(true);

    const [row] = await h.db.select({ base: settings.baseCurrency }).from(settings);
    expect(row?.base).toBe("EUR");
    expect(await h.db.select().from(currencyRates)).toHaveLength(0);
    const map = await loadRateMap(h.db, sig());
    expect(map.base).toBe("EUR");
    expect(map.rates.size).toBe(0);
  });

  it("is a no-op when the code is already the base, so rates survive", async () => {
    await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
    const result = await setBaseCurrency(h.db, admin, { code: "USD" }, sig());
    expect(result.ok).toBe(true);
    expect(await h.db.select().from(currencyRates)).toHaveLength(1);
  });

  it("refuses an unknown code and leaves settings untouched", async () => {
    const result = await setBaseCurrency(h.db, admin, { code: "ZZZ" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.CURRENCY_UNKNOWN);
    const [row] = await h.db.select({ base: settings.baseCurrency }).from(settings);
    expect(row?.base).toBe("USD");
  });

  it("refuses a caller without permissions.manage", async () => {
    const result = await setBaseCurrency(h.db, regular, { code: "EUR" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.PERM_DENIED);
    const [row] = await h.db.select({ base: settings.baseCurrency }).from(settings);
    expect(row?.base).toBe("USD");
  });
});
