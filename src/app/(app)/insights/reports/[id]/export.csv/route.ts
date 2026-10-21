import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { toCsv } from "@/features/insights/csv";
import { getReport } from "@/features/insights/reports";
import { runReport } from "@/features/insights/run";
import { createContext } from "@/server/trpc/context";

// GET /insights/reports/{id}/export.csv: the saved report as RFC 4180 CSV. The session is
// required and the report is re-read through the service, so the export can never reach a report
// the viewer may not read or a definition the builder did not save.

const routeParams = z.object({ id: z.uuid() });

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report"
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const parsed = routeParams.safeParse(await params);
  if (!parsed.success) return new NextResponse("Bad request", { status: 400 });
  const { actor } = await createContext();
  if (actor === null) return new NextResponse("Unauthorized", { status: 401 });

  const signal = AbortSignal.timeout(20_000);
  const report = await getReport(db, actor, parsed.data.id, signal);
  if (!report.ok) return new NextResponse("Not found", { status: 404 });

  const result = await runReport(db, actor, report.value.definition, signal);
  if (!result.ok) {
    return new NextResponse("Export failed", {
      status: result.error.id === ERROR_IDS.INSIGHT_QUERY_TIMEOUT ? 504 : 500,
    });
  }

  const csv = toCsv(result.value, report.value.definition);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(report.value.name)}-${day}.csv"`,
    },
  });
}
