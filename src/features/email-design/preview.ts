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
  // The 6.6 contract: a reply is identified by its thread, the mode is derived here.
  threadId?: string;
  subject?: string;
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
    // A fresh compose embeds the default signature into the body; append only when it is not
    // already there, so the preview never shows it twice.
    if (signature !== undefined && !body.includes(signature.bodyHtml)) {
      body += sanitizeAuthorHtml(signature.bodyHtml);
    }
  }
  const wrapped = wrapCustomerEmail({
    bodyHtml: body,
    mode: input.threadId === undefined ? "new" : "reply",
    layoutOverride: input.layout,
    design,
    subject: input.subject,
  });
  return { html: wrapped.html };
}
