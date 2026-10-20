import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { currencyRates, settings } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { invalidateBaseCurrencyCache } from "@/features/settings/readBaseCurrency";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { parseRate, type Rate } from "./money";
import { currencyCode, rateString } from "./schemas";
import type { RateMap } from "./totals";

// Manual exchange rates. rate_to_base = how many base units one unit of the code
// is worth. The base currency is never stored (rate 1) and a rate for it is refused.

const rateInput = z.object({ code: z.string(), rate: rateString });
const baseCurrencyInput = z.object({ code: z.string() });

export interface RateRow {
  code: string;
  rate: string;
  updatedAt: string;
}

export interface RateList {
  base: string;
  rates: RateRow[];
}

function canManageRates(actor: PermSetUser): boolean {
  // The base-currency setting already uses permissions.manage (settings/adminGate.ts).
  return can(actor, "permissions.manage");
}

function permissionDenied(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "permissions.manage required", { userId: actor.id });
}

function invalidInput(message: string): AppError {
  return new AppError(ERROR_IDS.CURRENCY_INPUT_INVALID, message);
}

export async function readBaseCurrency(db: DbOrTx, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ base: settings.baseCurrency })
    .from(settings)
    .where(eq(settings.id, true));
  return row?.base ?? "USD";
}

// Every converted read goes through this so the board, the deals list and the
// forecast convert identically.
export async function loadRateMap(db: DbOrTx, signal: AbortSignal): Promise<RateMap> {
  const base = await readBaseCurrency(db, signal);
  const rows = await db
    .select({ code: currencyRates.code, rate: currencyRates.rateToBase })
    .from(currencyRates);
  signal.throwIfAborted();
  const rates = new Map<string, Rate>();
  for (const row of rows) rates.set(row.code, parseRate(row.rate));
  return { base, rates };
}

export async function listRates(db: DbOrTx, signal: AbortSignal): Promise<RateList> {
  const base = await readBaseCurrency(db, signal);
  const rows = await db
    .select({
      code: currencyRates.code,
      rate: currencyRates.rateToBase,
      updatedAt: currencyRates.updatedAt,
    })
    .from(currencyRates)
    .orderBy(currencyRates.code);
  signal.throwIfAborted();
  return {
    base,
    rates: rows.map((row) => ({
      code: row.code,
      rate: row.rate,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function saveRate(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<RateRow, AppError>> {
  if (!canManageRates(actor)) return err(permissionDenied(actor));

  const parsed = rateInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput("rate input failed validation"));
  const code = currencyCode.safeParse(parsed.data.code);
  if (!code.success) return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));

  const base = await readBaseCurrency(db, signal);
  if (code.data === base) {
    return err(
      new AppError(ERROR_IDS.CURRENCY_BASE_RATE, "The base currency always has a rate of 1", {
        code: code.data,
      }),
    );
  }
  signal.throwIfAborted();

  const now = new Date();
  const [row] = await db
    .insert(currencyRates)
    .values({ code: code.data, rateToBase: parsed.data.rate, updatedBy: actor.id, updatedAt: now })
    .onConflictDoUpdate({
      target: currencyRates.code,
      set: { rateToBase: parsed.data.rate, updatedBy: actor.id, updatedAt: now },
    })
    .returning();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "saveRate: upsert returned no rows");
  }
  return ok({ code: row.code, rate: row.rateToBase, updatedAt: row.updatedAt.toISOString() });
}

export async function deleteRate(
  db: Db,
  actor: PermSetUser,
  code: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!canManageRates(actor)) return err(permissionDenied(actor));
  const parsed = currencyCode.safeParse(code);
  if (!parsed.success)
    return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));
  signal.throwIfAborted();
  await db.delete(currencyRates).where(eq(currencyRates.code, parsed.data));
  return ok(undefined);
}

export async function setBaseCurrency(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ base: string }, AppError>> {
  if (!canManageRates(actor)) return err(permissionDenied(actor));

  const parsed = baseCurrencyInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput("base currency input failed validation"));
  const code = currencyCode.safeParse(parsed.data.code);
  if (!code.success) return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));
  signal.throwIfAborted();

  const result = await db.transaction(async (tx) => {
    const current = await readBaseCurrency(tx, signal);
    // Re-selecting the same base is a no-op: clearing every manual rate for a
    // non-change would silently wipe the catalog.
    if (current === code.data) return ok({ base: current });

    await tx
      .insert(settings)
      .values({ id: true, baseCurrency: code.data })
      .onConflictDoUpdate({ target: settings.id, set: { baseCurrency: code.data } });
    await tx.delete(currencyRates);
    return ok({ base: code.data });
  });
  // The cached read must not keep serving the old base to pages rendered after this.
  invalidateBaseCurrencyCache(db);
  return result;
}
