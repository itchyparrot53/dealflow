import { err, ok, type Result } from "@/types/result";

// API list pagination. A cursor is an opaque base64url JSON key: the list orders by
// (updated_at, id) ascending, so the next page starts strictly after that pair. It carries no
// authority; a forged cursor only moves the window, never the visibility filter.

export type PageCursor = { updatedAt: string; id: string };

export function encodeCursor(cursor: PageCursor): string {
  const payload = JSON.stringify({ updatedAt: cursor.updatedAt, id: cursor.id });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeCursor(value: string): Result<PageCursor, string> {
  if (value.length === 0) return err("invalid cursor");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return err("invalid cursor");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return err("invalid cursor");
  }
  const record = parsed as Record<string, unknown>;
  const { updatedAt, id } = record;
  if (typeof updatedAt !== "string" || typeof id !== "string") return err("invalid cursor");
  if (id.length === 0 || Number.isNaN(Date.parse(updatedAt))) return err("invalid cursor");
  return ok({ updatedAt, id });
}
