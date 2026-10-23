import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { signatures } from "@/db/schema";
import { sanitizeAuthorHtml } from "@/features/email/sanitizeHtml";
import { getEmailDesign } from "./design";
import { type CustomerLayout, wrapCustomerEmail } from "./wrapCustomerEmail";

// The composer/editor preview (PLAN-PART13 6.6/6.7). It renders the same wrap the send path uses,
// with the author's signature appended, so a preview cannot drift from the wire copy.

export interface PreviewCustomerInput {
  bodyHtml: string;
  signatureId?: string;
  layout?: CustomerLayout;
  mode: "new" | "reply";
}

export async function renderCustomerPreview(
  db: Db,
  actorId: string,
  input: PreviewCustomerInput,
  signal: AbortSignal,
): Promise<{ html: string }> {
  const design = await getEmailDesign(db, signal);
  let body = sanitizeAuthorHtml(input.bodyHtml);
  if (input.signatureId !== undefined) {
    const [signature] = await db
      .select({ bodyHtml: signatures.bodyHtml })
      .from(signatures)
      .where(and(eq(signatures.id, input.signatureId), eq(signatures.userId, actorId)));
    signal.throwIfAborted();
    if (signature !== undefined) body += sanitizeAuthorHtml(signature.bodyHtml);
  }
  const wrapped = wrapCustomerEmail({
    bodyHtml: body,
    mode: input.mode,
    layoutOverride: input.layout,
    design,
  });
  return { html: wrapped.html };
}
