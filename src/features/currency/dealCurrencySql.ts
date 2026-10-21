import { type SQL, sql } from "drizzle-orm";

// The deal's currency: its terms row, else the install base currency, else USD (the deals.value
// comment in the schema). Every money aggregation groups by this expression and converts in
// TypeScript, so the database never adds two currencies together.

export function dealCurrencySql(termsAlias = "dt"): SQL {
  return sql`coalesce(${sql.raw(`${termsAlias}.currency`)}, (SELECT base_currency FROM settings WHERE id = true), 'USD')`;
}

/** Alias-aware column references for the joins every money aggregation needs. */
export function dealMoneyJoinSql(dealAlias = "d", termsAlias = "dt"): SQL {
  return sql`LEFT JOIN deal_terms ${sql.raw(termsAlias)} ON ${sql.raw(`${termsAlias}.deal_id`)} = ${sql.raw(`${dealAlias}.id`)}`;
}
