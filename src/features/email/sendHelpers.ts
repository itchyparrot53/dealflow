// Helpers extracted from send.ts to keep that file within the 300-line / complexity limits.
// These are internal to the email feature; not part of the public API surface.

import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { files } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import {
  type CustomerLayout,
  textForWrappedBody,
  wrapCustomerEmail,
} from "@/features/email-design/wrapCustomerEmail";
import { canActorAccessParent } from "@/features/files/fileAuthz";
import type { AuthUser } from "@/features/permissions/types";
import { err, ok, type Result } from "@/types/result";
import { assertSignatureOwner } from "./mailboxOwnership";
import { sanitizeAuthorHtml } from "./sanitizeHtml";
import type { PreparedEmail } from "./send";
import { mintTokensForSend, rewriteBody } from "./tracking";

// Resolved attachment metadata stored in the outbox payload so replay can rebuild MIME.
export interface ResolvedAttachment {
  fileId: string;
  s3Key: string;
  contentType: string;
  filename: string;
}

// Pull http(s) link hrefs out of authored html so tracking can tokenize them. The
// tracking layer re-validates each scheme; this is just a coarse extractor.
function extractLinks(html: string): string[] {
  const links: string[] = [];
  const re = /href=["']([^"']+)["']/g;
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    const href = m[1];
    if (href !== undefined) links.push(href);
    m = re.exec(html);
  }
  return links;
}

// Apply tracking token rewrites (Phase 2) then append the sanitised signature (Phase 4).
// Returns the final body string for MIME build and CRM copy storage.
export async function applyTrackingAndSignature(
  db: Db,
  args: {
    attemptId: string;
    actorId: string;
    sanitizedBody: string;
    signatureId: string | undefined;
    trackOpens: boolean;
    trackLinks: boolean;
    recipient: string;
    subject: string;
    wrapMode: "new" | "reply";
    layout?: CustomerLayout;
    prepared?: PreparedEmail;
    signal: AbortSignal;
  },
): Promise<Result<string, AppError>> {
  const { signal } = args;
  let body = args.sanitizedBody;

  if (args.trackOpens || args.trackLinks) {
    const minted = await mintTokensForSend(db, {
      sendAttemptId: args.attemptId,
      recipient: args.recipient,
      links: extractLinks(args.sanitizedBody),
      trackOpens: args.trackOpens,
      trackLinks: args.trackLinks,
      signal,
    });
    body = rewriteBody({
      html: args.sanitizedBody,
      openToken: minted.openToken,
      linkTokens: minted.linkTokens,
    });
    await db.execute(sql`
      UPDATE email_send_attempts
      SET payload = jsonb_set(payload, '{html}', ${JSON.stringify(body)}::jsonb)
      WHERE id=${args.attemptId}
    `);
    signal.throwIfAborted();
  }

  if (args.signatureId !== undefined) {
    const sig = await assertSignatureOwner(db, args.signatureId, args.actorId, signal);
    if (!sig.ok) return sig;
    body = body + sanitizeAuthorHtml(sig.value.bodyHtml);
    await db.execute(sql`
      UPDATE email_send_attempts
      SET payload = jsonb_set(payload, '{html}', ${JSON.stringify(body)}::jsonb)
      WHERE id=${args.attemptId}
    `);
    signal.throwIfAborted();
  }

  // Wrap AFTER tracking and the signature, so the pixel, the rewritten links and the signature are
  // all inside the layout and the stored/Sent copy is exactly what went on the wire. Documents and
  // automations arrive as sanitised author content plus structural summary/CTA in `prepared`; they
  // are wrapped here, once, not before the mailbox path.
  const design = await getEmailDesign(db, signal);
  const wrapped = wrapCustomerEmail({
    bodyHtml: body,
    mode: args.prepared?.mode ?? args.wrapMode,
    layoutOverride: args.layout,
    design,
    subject: args.subject,
    summary: args.prepared?.summary,
    cta: args.prepared?.cta,
  });
  if (wrapped.wrapped && wrapped.text !== null) {
    body = wrapped.html;
    await db.execute(sql`
      UPDATE email_send_attempts
      SET payload = jsonb_set(jsonb_set(payload, '{html}', ${JSON.stringify(body)}::jsonb), '{text}', to_jsonb(${wrapped.text}::text))
      WHERE id=${args.attemptId}
    `);
    signal.throwIfAborted();
  } else if (body.includes("data-df-layout")) {
    const text = textForWrappedBody(body);
    await db.execute(sql`
      UPDATE email_send_attempts
      SET payload = jsonb_set(payload, '{text}', to_jsonb(${text}::text))
      WHERE id=${args.attemptId}
    `);
    signal.throwIfAborted();
  }
  return ok(body);
}

// Authorize each fileId against the actor and return its storage metadata.
// Returns E_GMAIL_012 for any file that is missing, not ready, or not readable by
// the actor. Missing and inaccessible cases share the same message (no existence leak).
export async function resolveAttachments(
  db: Db,
  actor: AuthUser,
  attachments: Array<{ fileId: string }>,
  signal: AbortSignal,
): Promise<Result<ResolvedAttachment[], AppError>> {
  const resolved: ResolvedAttachment[] = [];
  for (const att of attachments) {
    const [row] = await db.select().from(files).where(eq(files.id, att.fileId));
    signal.throwIfAborted();
    if (row === undefined || row.status !== "ready") {
      return err(
        new AppError(ERROR_IDS.GMAIL_ATTACHMENT_DENIED, "attachment not found or not accessible", {
          fileId: att.fileId,
        }),
      );
    }
    const allowed = await canActorAccessParent(db, actor, row.entityType, row.entityId, signal);
    signal.throwIfAborted();
    if (!allowed) {
      return err(
        new AppError(ERROR_IDS.GMAIL_ATTACHMENT_DENIED, "attachment not found or not accessible", {
          fileId: att.fileId,
        }),
      );
    }
    resolved.push({
      fileId: att.fileId,
      s3Key: row.s3Key,
      contentType: row.contentType,
      filename: row.filename,
    });
  }
  return ok(resolved);
}
