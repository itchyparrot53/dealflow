import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { sanitizeAuthorHtml } from "@/features/email/sanitizeHtml";
import { getSystemMailer } from "@/features/mailer/systemMailer";
import type { SystemAttachment } from "@/features/mailer/types";
import { err, type Result } from "@/types/result";
import { getEmailDesign } from "./design";
import { renderEmail } from "./layout";
import { EMAIL_TEMPLATES, type EmailTemplateKey, isTemplateKey } from "./registry";
import { defaultTemplate, type ResolvedTemplate, resolveTemplate } from "./templates";
import { DEALFLOW_DESIGN, type EmailDesign } from "./tokens";
import { renderVariables, stripHeaderBreaks } from "./variables";

// The one entry point for product and customer system email (PLAN-PART13 6.4). It resolves the
// template, renders the variables, renders the layout, and sends through the system mailer. No
// sender builds HTML; the caller supplies data and (optionally) headers and attachments.

export interface SendSystemEmailOptions {
  headers?: Record<string, string>;
  attachments?: SystemAttachment[];
  design?: EmailDesign;
}

export interface RenderedSystemEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderSystemEmail(
  key: EmailTemplateKey,
  template: ResolvedTemplate,
  variables: Readonly<Record<string, string>>,
  companyDesign: EmailDesign,
): RenderedSystemEmail {
  const def = EMAIL_TEMPLATES[key];
  const subject = stripHeaderBreaks(
    renderVariables(template.subject, variables, { mode: "text" }),
    200,
  );
  const preheader =
    template.preheader === null || template.preheader === ""
      ? undefined
      : stripHeaderBreaks(renderVariables(template.preheader, variables, { mode: "text" }), 140);
  const bodyHtml = sanitizeAuthorHtml(
    renderVariables(template.bodyHtml, variables, { mode: "html" }),
  );
  const ctaUrl = def.cta === undefined ? undefined : variables[def.cta.urlVariable];
  const cta =
    def.cta !== undefined && template.ctaLabel !== null && ctaUrl !== undefined && ctaUrl !== ""
      ? {
          label: stripHeaderBreaks(
            renderVariables(template.ctaLabel, variables, { mode: "text" }),
            40,
          ),
          url: ctaUrl,
        }
      : undefined;
  const summary =
    def.summary === undefined
      ? undefined
      : {
          rows: def.summary.map((row) => ({
            label: row.label,
            value: renderVariables(row.value, variables, { mode: "text" }),
          })),
        };
  const footerExtraHtml =
    def.defaults.footerExtraHtml === undefined
      ? undefined
      : renderVariables(def.defaults.footerExtraHtml, variables, { mode: "html" });

  // Product mail always carries the Dealflow mark and the company's display name in its footer.
  const design: EmailDesign =
    def.family === "product"
      ? { ...DEALFLOW_DESIGN, displayName: companyDesign.displayName }
      : companyDesign;

  const rendered = renderEmail({
    family: def.family,
    layout: "branded",
    design,
    preheader,
    bodyHtml,
    cta,
    summary,
    footerExtraHtml,
    subject,
  });
  return { subject, html: rendered.html, text: rendered.text };
}

export async function sendSystemEmail(
  db: Db,
  key: string,
  to: string,
  variables: Readonly<Record<string, string>>,
  signal: AbortSignal,
  opts: SendSystemEmailOptions = {},
): Promise<Result<{ messageId: string }, AppError>> {
  if (!isTemplateKey(key)) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_TEMPLATE_UNKNOWN, "unknown template key", { key }),
    );
  }
  if (EMAIL_TEMPLATES[key].editable === false) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID, "template is not sent through this path", {
        key,
      }),
    );
  }
  const resolved = await resolveTemplate(db, key, signal);
  if (!resolved.ok) return resolved;
  const design = opts.design ?? (await getEmailDesign(db, signal));
  const rendered = renderSystemEmail(key, resolved.value, variables, design);

  const headers: Record<string, string> = { ...opts.headers };
  if (key === "notification") {
    const base = variables["app.url"] ?? env.BASE_URL;
    headers["List-Unsubscribe"] = `<${base.replace(/\/$/, "")}/settings/notifications>`;
  }
  return getSystemMailer().send(
    {
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers,
      attachments: opts.attachments,
    },
    signal,
  );
}

// Exported for the editor and the gallery: the exact default HTML for one key, without a database.
export function renderDefaultTemplate(
  key: EmailTemplateKey,
  variables: Readonly<Record<string, string>>,
  design: EmailDesign,
): RenderedSystemEmail {
  return renderSystemEmail(key, defaultTemplate(key), variables, design);
}
