import { decodeCursor, encodeCursor } from "./cursor";

// A visibility-filtered list page. Visibility for people, organizations and activities is
// resolved in JS (the same helpers the UI uses), so the scan keeps pulling keyset batches until
// the page is full or the table is exhausted. It never silently ends a page that is full: reaching
// `limit` always returns a cursor, and an invalid cursor is reported instead of ignored.

export interface ScanRow {
  id: string;
  updatedAt: Date;
}

export interface ScanBatch {
  after: { updatedAt: string; id: string } | null;
  size: number;
}

export type ScanResult<T> =
  | { ok: true; rows: T[]; nextCursor?: string }
  | { ok: false; invalidCursor: true };

function decodeAfter(cursor: string | undefined): ScanBatch["after"] | "invalid" {
  if (cursor === undefined) return null;
  const decoded = decodeCursor(cursor);
  return decoded.ok ? { updatedAt: decoded.value.updatedAt, id: decoded.value.id } : "invalid";
}

async function collect<T extends ScanRow>(
  fetchBatch: (batch: ScanBatch) => Promise<T[]>,
  visible: (row: T) => Promise<boolean> | boolean,
  start: ScanBatch["after"],
  limit: number,
): Promise<{ rows: T[]; nextCursor?: string }> {
  let after = start;
  const batchSize = Math.max(limit * 4, 50);
  const rows: T[] = [];
  for (;;) {
    const batch = await fetchBatch({ after, size: batchSize });
    if (batch.length === 0) break;
    for (const row of batch) {
      after = { updatedAt: row.updatedAt.toISOString(), id: row.id };
      if (!(await visible(row))) continue;
      rows.push(row);
      if (rows.length === limit) {
        return {
          rows,
          nextCursor: encodeCursor({ updatedAt: row.updatedAt.toISOString(), id: row.id }),
        };
      }
    }
    if (batch.length < batchSize) break;
  }
  return { rows };
}

export async function scanVisiblePage<T extends ScanRow>(
  fetchBatch: (batch: ScanBatch) => Promise<T[]>,
  visible: (row: T) => Promise<boolean> | boolean,
  cursor: string | undefined,
  limit: number,
): Promise<ScanResult<T>> {
  const after = decodeAfter(cursor);
  if (after === "invalid") return { ok: false, invalidCursor: true };
  const result = await collect(fetchBatch, visible, after, limit);
  return { ok: true, rows: result.rows, nextCursor: result.nextCursor };
}
