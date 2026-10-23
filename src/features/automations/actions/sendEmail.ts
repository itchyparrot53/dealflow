import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { EMAIL_ACTION_COOLDOWN_HOURS } from "@/constants/automations";
import { ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailTemplates, persons } from "@/db/schema";
import { renderVariables } from "@/features/documents/variables";
import { getActorMailboxStatus } from "@/features/email/mailboxOwnership";
import { type SendEmailInput, sendEmail as sendMail } from "@/features/email/send";
import { getEmailDesign } from "@/features/email-design/design";
import { wrapCustomerEmail } from "@/features/email-design/wrapCustomerEmail";
import { makeStorageClient, type StorageClient } from "@/features/files/storage";
import { type ResolveDeps, resolveMailProvider } from "@/features/mail/provider/resolve";
import type { ActionContext, StepResult } from "../runner";
import { loadDealRow, loadVariableContext } from "./context";
import { registerActionHandler } from "./registry";

// send_email sends one saved email template through the automation creator's connected mailbox to
// the deal's primary person. It is rate-limited per automation and person (`EMAIL_ACTION_COOLDOWN_HOURS`)
// by reading earlier runs' steps, and it never sends without a person, an address or a mailbox.

export interface SendEmailActionDeps {
  resolveDeps?: ResolveDeps;
  storage?: StorageClient;
}

let testDeps: SendEmailActionDeps | undefined;

// Tests install the fake IMAP transport here; production leaves it unset.
export function setSendEmailActionDepsForTest(deps: SendEmailActionDeps | undefined): void {
  testDeps = deps;
}

function skipped(detail: string): StepResult {
  return { ok: false, errorId: ERROR_IDS.AUTOMATION_EMAIL_SKIPPED, detail };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function emailedRecently(
  db: Db,
  automationId: string,
  personId: string,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  const detail = `email:${personId}`;
  const result = await db.execute(sql`
    SELECT 1
    FROM automation_runs r,
         jsonb_array_elements(r.steps) AS step
    WHERE r.automation_id = ${automationId}
      AND r.started_at > now() - ${EMAIL_ACTION_COOLDOWN_HOURS} * interval '1 hour'
      AND step->>'type' = 'send_email'
      AND step->>'detail' = ${detail}
      AND step->>'ok' = 'true'
    LIMIT 1
  `);
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}

registerActionHandler("send_email", async (ctx, action) => {
  if (action.type !== "send_email") return skipped("wrong action");
  if (ctx.dealId === null) return skipped("no related deal");

  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null || deal.personId === null) return skipped("no person on the deal");

  const [person] = await ctx.db
    .select({ id: persons.id, email: persons.primaryEmail })
    .from(persons)
    .where(eq(persons.id, deal.personId));
  if (person?.email == null || person.email === "") return skipped("person has no email");

  if (await emailedRecently(ctx.db, ctx.automationId, person.id, ctx.signal)) {
    return skipped("within the email cooldown");
  }

  const [template] = await ctx.db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.id, action.templateId),
        or(eq(emailTemplates.ownerId, ctx.actor.id), eq(emailTemplates.isShared, true)),
      ),
    );
  if (template === undefined) return skipped("template not found");

  const mailbox = await getActorMailboxStatus(ctx.db, ctx.actor.id, ctx.signal);
  if (mailbox === null || mailbox.status !== "connected") return skipped("no connected mailbox");

  const variables = await loadVariableContext(ctx.db, ctx.dealId, ctx.signal);
  const safeVariables = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]),
  );
  const subject = renderVariables(template.subject ?? template.name, variables).slice(0, 200);
  const rawBodyHtml = renderVariables(template.bodyHtml, safeVariables);
  const design = await getEmailDesign(ctx.db, ctx.signal);
  const bodyHtml = wrapCustomerEmail({ bodyHtml: rawBodyHtml, mode: "automation", design }).html;

  const deps = testDeps ?? {};
  const provider = await resolveMailProvider(ctx.db, mailbox.id, ctx.signal, deps.resolveDeps);
  if (!provider.ok) {
    return { ok: false, errorId: provider.error.id, detail: "mail provider failed" };
  }

  const payload: SendEmailInput = {
    accountId: mailbox.id,
    idempotencyKey: randomUUID(),
    to: [person.email],
    subject,
    bodyHtml,
    linkDealId: ctx.dealId,
    linkPersonId: person.id,
  };

  try {
    const sent = await sendMail(ctx.db, {
      actorId: ctx.actor.id,
      actorType: ctx.actor.type,
      actorGroupIds: ctx.actor.groupIds,
      provider: provider.value,
      storage: deps.storage ?? makeStorageClient(),
      input: payload,
    });
    if (!sent.ok) return { ok: false, errorId: sent.error.id, detail: "send failed" };
  } finally {
    await provider.value.close();
  }

  return { ok: true, detail: `email:${person.id}` };
});

export type { ActionContext };
