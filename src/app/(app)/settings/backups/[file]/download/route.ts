import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { env } from "@/config/env";
import { isBackupFileName } from "@/features/backups/retention";
import { createContext } from "@/server/trpc/context";

// Admin download of a finished archive. The name is validated against the exact pattern this job
// writes BEFORE it ever reaches the filesystem, so "../../etc/passwd" and any foreign name are
// refused; no path traversal is possible.

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await ctx.params;
  const { actor } = await createContext();
  if (actor === null || actor.type !== "admin") {
    return Response.json(
      { error: { id: "E_PERM_001", message: "admin required" } },
      { status: 403 },
    );
  }
  if (!isBackupFileName(file)) {
    return Response.json(
      { error: { id: "E_BACKUP_002", message: "backup not found" } },
      { status: 404 },
    );
  }
  const path = join(env.BACKUP_DIR, file);
  try {
    const info = await stat(path);
    if (!info.isFile()) {
      return Response.json(
        { error: { id: "E_BACKUP_002", message: "backup not found" } },
        { status: 404 },
      );
    }
    const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>;
    return new Response(stream, {
      headers: {
        "content-type": "application/gzip",
        "content-disposition": `attachment; filename="${file}"`,
        "content-length": String(info.size),
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: { id: "E_BACKUP_002", message: "backup not found" } },
      { status: 404 },
    );
  }
}
