import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { campaignRecipientsCsv, getCampaignRecipients } from "@/features/campaigns/reports";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

// GET /campaigns/{id}/report/recipients.csv. The recipients read applies the viewer's people
// visibility, so the export contains exactly the rows the report table may show. data.export is
// the flag every CSV route in the app uses.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { actor } = await createContext();
  if (actor === null) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(actor, "campaigns.view") || !can(actor, "data.export")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const recipients = await getCampaignRecipients(db, actor, id, AbortSignal.timeout(20_000));
  return new NextResponse(campaignRecipientsCsv(recipients.rows), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="campaign-recipients-${id}.csv"`,
    },
  });
}
