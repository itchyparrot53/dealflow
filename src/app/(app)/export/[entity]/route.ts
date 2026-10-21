import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { statusForError } from "@/features/api/status";
import { csvStream } from "@/features/export/csv";
import { exportTable } from "@/features/export/exports";
import { createContext } from "@/server/trpc/context";

// GET /export/{entity}: a session-authenticated CSV download. It reuses the list query (and its
// visibility), streams through csvStream, and is gated on data.export.

export const dynamic = "force-dynamic";

async function* rowsIterable(
  rows: (string | number | null)[][],
): AsyncIterable<(string | number | null)[]> {
  for (const row of rows) yield row;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ entity: string }> },
): Promise<Response> {
  const { entity } = await ctx.params;
  const { actor } = await createContext();
  if (actor === null) {
    return Response.json(
      { error: { id: "E_AUTH_003", message: "sign in required" } },
      { status: 401 },
    );
  }
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await exportTable(db, actor, entity, params, AbortSignal.timeout(120_000));
  if (!result.ok) {
    return Response.json(
      { error: { id: result.error.id, message: result.error.message } },
      { status: statusForError(result.error.id) },
    );
  }
  const stream = csvStream(result.value.header, rowsIterable(result.value.rows));
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${result.value.filename}"`,
      "cache-control": "no-store",
    },
  });
}
