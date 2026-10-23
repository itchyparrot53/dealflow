import { type EmailLayout, type EmailSummary, htmlToText, renderEmail } from "./layout";
import type { EmailDesign } from "./tokens";

// Wraps a customer email in the company layout (PLAN-PART13 6.6). One pass only: the
// data-df-layout marker makes a second attempt a no-op, which is what keeps a scheduled send or a
// document that was already wrapped from being nested twice.

export type CustomerWrapMode = "new" | "reply" | "automation" | "document";
export type CustomerLayout = "branded" | "minimal" | "plain";

export interface WrapCustomerEmailInput {
  bodyHtml: string;
  mode: CustomerWrapMode;
  layoutOverride?: CustomerLayout | null;
  design: EmailDesign;
  preheader?: string;
  subject?: string;
  summary?: EmailSummary;
  cta?: { label: string; url: string };
}

export interface WrappedCustomerEmail {
  html: string;
  text: string | null;
  layout: CustomerLayout | null;
  wrapped: boolean;
}

export function resolveCustomerLayout(
  mode: CustomerWrapMode,
  design: EmailDesign,
  layoutOverride?: CustomerLayout | null,
): CustomerLayout {
  if (layoutOverride !== undefined && layoutOverride !== null) return layoutOverride;
  if (mode === "document") return "branded";
  if (mode === "reply") return design.replyLayout;
  return design.newEmailLayout;
}

export function wrapCustomerEmail(input: WrapCustomerEmailInput): WrappedCustomerEmail {
  if (input.bodyHtml.includes("data-df-layout")) {
    return { html: input.bodyHtml, text: null, layout: null, wrapped: false };
  }
  const layout = resolveCustomerLayout(input.mode, input.design, input.layoutOverride);
  if (layout === "plain") {
    return { html: input.bodyHtml, text: null, layout, wrapped: false };
  }
  const rendered = renderEmail({
    family: "customer",
    layout: layout satisfies EmailLayout,
    design: input.design,
    bodyHtml: input.bodyHtml,
    preheader: input.preheader,
    subject: input.subject,
    summary: input.summary,
    cta: input.cta,
  });
  return { html: rendered.html, text: rendered.text, layout, wrapped: true };
}

// Used when an already-wrapped body (a document or an automation) reaches the mailbox path: the
// MIME builder still wants a text part, and deriving it here is safe because the HTML is ours.
export function textForWrappedBody(bodyHtml: string): string {
  return htmlToText(bodyHtml);
}
