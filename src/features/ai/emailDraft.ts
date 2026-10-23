import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { organizations, settings, stages } from "@/db/schema";
import { listNotes } from "@/features/collaboration/notesRepo";
import { type ContactActor, getPerson } from "@/features/contacts/personsRepo";
import { getWorkspace } from "@/features/deal-workspace/summaryRepo";
import type { HydratedActor } from "@/server/hydrateActor";
import { ok, type Result } from "@/types/result";
import { chatJson } from "./chatJson";

export const EMAIL_TONES = ["friendly", "formal", "short"] as const;
export type EmailTone = (typeof EMAIL_TONES)[number];

export const TONE_TEXT: Record<EmailTone, string> = {
  friendly: "warm and friendly but professional",
  formal: "formal and polite",
  short: "very brief, 3 to 5 sentences",
};

export const emailDraftInputSchema = z.object({
  instruction: z.string().min(1).max(500),
  tone: z.enum(EMAIL_TONES),
  dealId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  recipientEmail: z.string().email().optional(),
});

export type EmailDraftInput = z.infer<typeof emailDraftInputSchema>;

export interface EmailDraft {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

const MAX_NOTES = 5;
const NOTE_BODY_LIMIT = 300;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character] ?? character;
  });
}

// Plain text to the composer's HTML: blank lines separate paragraphs, single newlines break within.
export function textToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function emailDraftPrompt(userName: string, companyName: string, tone: EmailTone): string {
  return `You write sales emails for ${userName} at ${companyName}. Tone: ${TONE_TEXT[tone]}. Write in British English. Reply with JSON only: {"subject": string (max 120 characters), "body": string (plain text, no markdown, with a greeting and a sign-off using the sender's first name, max 250 words)}. Use only facts from the context. Do not invent prices, dates or promises.`;
}

const draftSchema = z
  .object({ subject: z.string(), body: z.string() })
  .transform((value) => ({ subject: value.subject.slice(0, 120), body: value.body }));

async function companyNameFor(db: Db, signal: AbortSignal): Promise<string> {
  const [row] = await db
    .select({ companyName: settings.companyName })
    .from(settings)
    .where(eq(settings.id, true))
    .limit(1);
  signal.throwIfAborted();
  const name = row?.companyName ?? "";
  return name.trim() === "" ? "our company" : name;
}

async function recipientFor(
  db: Db,
  actor: HydratedActor,
  input: EmailDraftInput,
  signal: AbortSignal,
): Promise<
  Result<
    { name: string | null; organization: string | null; email: string | null } | null,
    AppError
  >
> {
  if (input.personId === undefined) {
    return ok(
      input.recipientEmail === undefined
        ? null
        : { name: null, organization: null, email: input.recipientEmail },
    );
  }
  // The contacts read used by the person page applies the actor's contact visibility.
  const contactActor: ContactActor = { ...actor, primaryVisibilityGroupId: null };
  const person = await getPerson(db, contactActor, input.personId, signal);
  if (!person.ok) return person;
  let organization: string | null = null;
  if (person.value.orgId !== null) {
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, person.value.orgId))
      .limit(1);
    organization = org?.name ?? null;
  }
  return ok({
    name: person.value.name,
    organization,
    email: input.recipientEmail ?? person.value.primaryEmail ?? null,
  });
}

async function dealContextFor(
  db: Db,
  actor: HydratedActor,
  dealId: string,
  signal: AbortSignal,
): Promise<
  Result<
    {
      title: string;
      stage: string | null;
      value: number | null;
      expectedCloseDate: string | null;
    } | null,
    AppError
  >
> {
  const workspace = await getWorkspace(db, actor, dealId, signal);
  if (!workspace.ok) return workspace;
  const [stage] = await db
    .select({ name: stages.name })
    .from(stages)
    .where(eq(stages.id, workspace.value.deal.stageId))
    .limit(1);
  const deal = workspace.value.deal;
  return ok({
    title: deal.title,
    stage: stage?.name ?? null,
    value: deal.value === null ? null : Number(deal.value),
    expectedCloseDate: deal.expectedCloseDate,
  });
}

export async function draftEmail(
  db: Db,
  actor: HydratedActor,
  input: EmailDraftInput,
  signal: AbortSignal,
): Promise<Result<EmailDraft, AppError>> {
  const [companyName, recipient, deal] = await Promise.all([
    companyNameFor(db, signal),
    recipientFor(db, actor, input, signal),
    input.dealId === undefined
      ? Promise.resolve(ok(null))
      : dealContextFor(db, actor, input.dealId, signal),
  ]);
  if (!recipient.ok) return recipient;
  if (!deal.ok) return deal;

  const recentNotes =
    input.dealId === undefined
      ? []
      : (await listNotes(db, "deal", input.dealId, signal))
          .slice(0, MAX_NOTES)
          .map((note) => note.body.slice(0, NOTE_BODY_LIMIT));

  const user = JSON.stringify({
    instruction: input.instruction,
    recipient: recipient.value,
    deal: deal.value,
    recentNotes,
  });
  const result = await chatJson(
    db,
    actor.id,
    "email_draft",
    {
      system: emailDraftPrompt(actor.name, companyName, input.tone),
      user,
      schema: draftSchema,
      maxTokens: 1500,
    },
    signal,
  );
  if (!result.ok) return result;
  return ok({
    subject: result.value.subject,
    bodyText: result.value.body,
    bodyHtml: textToHtml(result.value.body),
  });
}
