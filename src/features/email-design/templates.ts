import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailTemplateOverrides } from "@/db/schema";
import { sanitizeAuthorHtml } from "@/features/email/sanitizeHtml";
import { recordAudit } from "@/features/identity/audit";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATES,
  type EmailTemplateKey,
  isTemplateKey,
} from "./registry";

// Template overrides (PLAN-PART13 6.3/6.4). An override is a full replacement: every field is what
// the admin saved, so clearing the preheader clears it rather than reverting to the default.

export interface ResolvedTemplate {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  ctaLabel: string | null;
}

export interface TemplateInput {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  ctaLabel: string | null;
}

export interface TemplateListItem {
  key: EmailTemplateKey;
  name: string;
  family: "product" | "customer";
  audience: "Your team" | "Customers";
  editable: boolean;
  updatedAt: string | null;
}

const MAX_SUBJECT = 200;
const MAX_PREHEADER = 140;
const MAX_BODY = 20_000;
const MAX_CTA = 40;

export function defaultTemplate(key: EmailTemplateKey): ResolvedTemplate {
  const def = EMAIL_TEMPLATES[key];
  return {
    subject: def.defaults.subject,
    preheader: def.defaults.preheader === "" ? null : def.defaults.preheader,
    bodyHtml: def.defaults.bodyHtml,
    ctaLabel: def.defaults.ctaLabel ?? null,
  };
}

function admin(actor: PermSetUser | null): Result<PermSetUser, AppError> {
  if (actor === null || actor.type !== "admin") {
    return err(new AppError(ERROR_IDS.PERM_DENIED, "admin only"));
  }
  return ok(actor);
}

function invalid(message: string): AppError {
  return new AppError(ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID, message);
}

function validate(defEditable: boolean, input: TemplateInput): AppError | null {
  if (!defEditable) return invalid("this template is not editable");
  if (input.subject.trim() === "" || input.subject.length > MAX_SUBJECT) {
    return invalid(`subject must be between 1 and ${MAX_SUBJECT} characters`);
  }
  if (input.preheader !== null && input.preheader.length > MAX_PREHEADER) {
    return invalid(`preview line must be at most ${MAX_PREHEADER} characters`);
  }
  if (input.bodyHtml.trim() === "" || input.bodyHtml.length > MAX_BODY) {
    return invalid(`body must be between 1 and ${MAX_BODY} characters`);
  }
  if (input.ctaLabel !== null && input.ctaLabel.length > MAX_CTA) {
    return invalid(`button label must be at most ${MAX_CTA} characters`);
  }
  return null;
}

export async function resolveTemplate(
  db: Db,
  key: EmailTemplateKey,
  signal: AbortSignal,
): Promise<Result<ResolvedTemplate, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(emailTemplateOverrides)
    .where(eq(emailTemplateOverrides.key, key));
  if (row === undefined) return ok(defaultTemplate(key));
  return ok({
    subject: row.subject,
    preheader: row.preheader,
    bodyHtml: row.bodyHtml,
    ctaLabel: row.ctaLabel,
  });
}

export async function saveTemplate(
  db: Db,
  actor: PermSetUser | null,
  key: string,
  input: TemplateInput,
  signal: AbortSignal,
): Promise<Result<ResolvedTemplate, AppError>> {
  const allowed = admin(actor);
  if (!allowed.ok) return allowed;
  if (!isTemplateKey(key)) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_TEMPLATE_UNKNOWN, "unknown template key", { key }),
    );
  }
  const problem = validate(EMAIL_TEMPLATES[key].editable !== false, input);
  if (problem !== null) return err(problem);

  const bodyHtml = sanitizeAuthorHtml(input.bodyHtml);
  const ctaLabel =
    input.ctaLabel === null || input.ctaLabel.trim() === ""
      ? (EMAIL_TEMPLATES[key].defaults.ctaLabel ?? null)
      : input.ctaLabel.trim();
  await db
    .insert(emailTemplateOverrides)
    .values({
      key,
      subject: input.subject.trim(),
      preheader: input.preheader === null ? null : input.preheader.trim(),
      bodyHtml,
      ctaLabel,
      updatedBy: allowed.value.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: emailTemplateOverrides.key,
      set: {
        subject: input.subject.trim(),
        preheader: input.preheader === null ? null : input.preheader.trim(),
        bodyHtml,
        ctaLabel,
        updatedBy: allowed.value.id,
        updatedAt: new Date(),
      },
    });
  signal.throwIfAborted();
  await recordAudit(
    db,
    {
      actorId: allowed.value.id,
      targetType: "settings",
      targetId: null,
      action: "email_template.updated",
      after: { key, subject: input.subject.trim(), ctaLabel },
    },
    signal,
  );
  return resolveTemplate(db, key, signal);
}

export async function resetTemplate(
  db: Db,
  actor: PermSetUser | null,
  key: string,
  signal: AbortSignal,
): Promise<Result<ResolvedTemplate, AppError>> {
  const allowed = admin(actor);
  if (!allowed.ok) return allowed;
  if (!isTemplateKey(key)) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_TEMPLATE_UNKNOWN, "unknown template key", { key }),
    );
  }
  await db.delete(emailTemplateOverrides).where(eq(emailTemplateOverrides.key, key));
  signal.throwIfAborted();
  await recordAudit(
    db,
    {
      actorId: allowed.value.id,
      targetType: "settings",
      targetId: null,
      action: "email_template.updated",
      after: { key, reset: true },
    },
    signal,
  );
  return ok(defaultTemplate(key));
}

export async function listTemplates(db: Db, signal: AbortSignal): Promise<TemplateListItem[]> {
  signal.throwIfAborted();
  const rows = await db.select().from(emailTemplateOverrides);
  const overrides = new Map(rows.map((row) => [row.key, row]));
  return EMAIL_TEMPLATE_KEYS.map((key) => {
    const def = EMAIL_TEMPLATES[key];
    const override = overrides.get(key);
    return {
      key,
      name: def.name,
      family: def.family,
      audience: def.audience,
      editable: def.editable !== false,
      updatedAt: override?.updatedAt.toISOString() ?? null,
    };
  });
}
