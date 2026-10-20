// Part 3 demo data: products, manual rates, stage probabilities, deal lines and a
// spread of close dates. Kept out of seed-demo.ts so both stay readable.

import type { Db } from "./seed-smoke-phase5-infra";

interface ProductSeed {
  name: string;
  code: string;
  price: string;
  currency: string;
  tax: string;
}

const PRODUCTS: ProductSeed[] = [
  { name: "Consulting day", code: "CONSULT", price: "1200.00", currency: "USD", tax: "20" },
  { name: "Implementation package", code: "IMPL", price: "5000.00", currency: "USD", tax: "0" },
  { name: "Support retainer", code: "SUPPORT", price: "900.00", currency: "USD", tax: "0" },
  { name: "Training day", code: "TRAINING", price: "800.00", currency: "USD", tax: "10" },
  { name: "Euro widget", code: "EUROW", price: "1000.00", currency: "EUR", tax: "20" },
  { name: "Euro support", code: "EUROS", price: "2500.00", currency: "EUR", tax: "0" },
];

const STAGE_PROBABILITIES = [10, 25, 50, 75, 90];

interface SalesArgs {
  pipelineId: string;
  stageIds: string[];
  dealIds: string[];
  ownerId: string;
}

async function baseCurrency(db: Db): Promise<string> {
  const [row] = await db.q<{ base: string }>(
    `SELECT base_currency AS base FROM settings WHERE id = true`,
  );
  return row?.base ?? "USD";
}

async function ensureProduct(db: Db, product: ProductSeed, ownerId: string): Promise<string> {
  const [existing] = await db.q<{ id: string }>(`SELECT id FROM products WHERE code = $1`, [
    product.code,
  ]);
  if (existing !== undefined) {
    await db.q(
      `UPDATE products SET name = $2, price = $3, currency = $4, tax_percent = $5,
         active = true, updated_at = now() WHERE id = $1`,
      [existing.id, product.name, product.price, product.currency, product.tax],
    );
    return existing.id;
  }
  const [row] = await db.q<{ id: string }>(
    `INSERT INTO products (name, code, price, currency, tax_percent, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [product.name, product.code, product.price, product.currency, product.tax, ownerId],
  );
  if (row === undefined) throw new Error(`product insert failed: ${product.code}`);
  return row.id;
}

async function addLine(
  db: Db,
  dealId: string,
  productId: string,
  quantity: string,
  itemPrice: string,
  discount: string,
  tax: string,
): Promise<void> {
  await db.q(`DELETE FROM deal_products WHERE deal_id = $1`, [dealId]);
  await db.q(
    `INSERT INTO deal_products
       (deal_id, product_id, position, quantity, item_price, discount_percent, tax_percent)
     VALUES ($1, $2, 1, $3, $4, $5, $6)`,
    [dealId, productId, quantity, itemPrice, discount, tax],
  );
  await db.q(
    `UPDATE deals SET value = (
       SELECT round(sum(quantity * item_price * (100 - discount_percent) / 100), 2)
       FROM deal_products WHERE deal_id = $1
     ) WHERE id = $1`,
    [dealId],
  );
}

async function ensureCurrencyDeal(
  db: Db,
  args: SalesArgs,
  title: string,
  currency: string,
  value: string | null,
): Promise<string> {
  const stageId = args.stageIds[0] ?? "";
  const [existing] = await db.q<{ id: string }>(
    `SELECT id FROM deals WHERE pipeline_id = $1 AND title = $2 AND deleted_at IS NULL LIMIT 1`,
    [args.pipelineId, title],
  );
  let dealId = existing?.id;
  if (dealId === undefined) {
    const [row] = await db.q<{ id: string }>(
      `INSERT INTO deals
         (title, status, value, pipeline_id, stage_id, board_position, owner_id, visibility_level)
       VALUES ($1, 'open', $2, $3, $4, 900, $5, 'all') RETURNING id`,
      [title, value, args.pipelineId, stageId, args.ownerId],
    );
    if (row === undefined) throw new Error(`deal insert failed: ${title}`);
    dealId = row.id;
  } else {
    await db.q(`UPDATE deals SET value = $2, status = 'open' WHERE id = $1`, [dealId, value]);
  }
  await db.q(
    `INSERT INTO deal_terms (deal_id, currency)
     VALUES ($1, $2)
     ON CONFLICT (deal_id) DO UPDATE SET currency = EXCLUDED.currency, updated_at = now()`,
    [dealId, currency],
  );
  return dealId;
}

async function seedCatalog(db: Db, ownerId: string, base: string): Promise<Map<string, string>> {
  const productIds = new Map<string, string>();
  for (const product of PRODUCTS) {
    productIds.set(product.code, await ensureProduct(db, product, ownerId));
  }
  for (const [code, rate] of [
    ["EUR", "1.08"],
    ["GBP", "1.27"],
  ] as const) {
    if (code === base) continue;
    await db.q(
      `INSERT INTO currency_rates (code, rate_to_base, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET rate_to_base = EXCLUDED.rate_to_base, updated_at = now()`,
      [code, rate, ownerId],
    );
  }
  return productIds;
}

async function seedStageProbabilities(db: Db, stageIds: string[]): Promise<void> {
  for (let index = 0; index < stageIds.length; index += 1) {
    const probability = STAGE_PROBABILITIES[index] ?? 90;
    await db.q(
      `INSERT INTO stage_probabilities (stage_id, probability)
       VALUES ($1, $2)
       ON CONFLICT (stage_id) DO UPDATE SET probability = EXCLUDED.probability`,
      [stageIds[index], probability],
    );
  }
}

async function seedDemoLines(
  db: Db,
  args: SalesArgs,
  productIds: Map<string, string>,
): Promise<number> {
  let lineCount = 0;
  const open = await db.q<{ id: string }>(
    `SELECT id FROM deals
     WHERE id = ANY($1::uuid[]) AND status = 'open' AND deleted_at IS NULL
     ORDER BY title LIMIT 5`,
    [args.dealIds],
  );
  for (let index = 0; index < open.length; index += 1) {
    const deal = open[index];
    const product = PRODUCTS[index % 3];
    if (deal === undefined || product === undefined) continue;
    const productId = productIds.get(product.code);
    if (productId === undefined) continue;
    await addLine(
      db,
      deal.id,
      productId,
      index % 2 === 0 ? "2" : "1",
      product.price,
      index === 0 ? "10" : "0",
      product.tax,
    );
    lineCount += 1;
  }

  const eurDeal = await ensureCurrencyDeal(db, args, "Demo EUR expansion", "EUR", null);
  const euroProduct = productIds.get("EUROW");
  if (euroProduct !== undefined) {
    await addLine(db, eurDeal, euroProduct, "2", "1000.00", "10", "20");
    lineCount += 1;
  }
  const gbpDeal = await ensureCurrencyDeal(db, args, "Demo GBP rollout", "GBP", null);
  const consulting = productIds.get("CONSULT");
  if (consulting !== undefined) {
    await addLine(db, gbpDeal, consulting, "1", "1000.00", "0", "20");
    lineCount += 1;
  }
  const jpyDeal = await ensureCurrencyDeal(db, args, "Demo JPY renewal", "JPY", "500000.00");
  await db.q(`DELETE FROM deal_products WHERE deal_id = $1`, [jpyDeal]);
  return lineCount;
}

async function spreadCloseDates(db: Db, pipelineId: string): Promise<void> {
  const ranked = await db.q<{ id: string; rn: string }>(
    `SELECT id, row_number() OVER (ORDER BY title) AS rn
     FROM deals WHERE pipeline_id = $1 AND status = 'open' AND deleted_at IS NULL`,
    [pipelineId],
  );
  for (const row of ranked) {
    const rank = Number(row.rn);
    if (rank <= 2) {
      await db.q(
        `UPDATE deals SET expected_close_date = (current_date - ($2 || ' days')::interval)::date
         WHERE id = $1`,
        [row.id, String(rank * 10)],
      );
    } else if (rank <= 5) {
      await db.q(`UPDATE deals SET expected_close_date = NULL WHERE id = $1`, [row.id]);
    } else {
      await db.q(
        `UPDATE deals SET expected_close_date = (current_date + ($2 || ' months')::interval)::date
         WHERE id = $1`,
        [row.id, String(rank % 6)],
      );
    }
  }
}

export async function seedSales(
  db: Db,
  args: SalesArgs,
): Promise<{ products: number; lines: number; overdue: number; undated: number }> {
  const base = await baseCurrency(db);
  const productIds = await seedCatalog(db, args.ownerId, base);
  await seedStageProbabilities(db, args.stageIds);
  const lines = await seedDemoLines(db, args, productIds);
  await spreadCloseDates(db, args.pipelineId);
  return { products: PRODUCTS.length, lines, overdue: 2, undated: 3 };
}
