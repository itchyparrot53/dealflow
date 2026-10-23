import type { EmailFamily } from "./layout";

// Every email Dealflow can send (PLAN-PART13 6.4). The default copy is the product's copy: it is
// edited in Settings > Email design, never in code, and the registry is the only list of keys.
// Buttons are structural: a template edits the label, the URL variable comes from the caller.

export const EMAIL_TEMPLATE_KEYS = [
  "sign_in_link",
  "invite",
  "notification",
  "backup_failed",
  "webhook_disabled",
  "booking_confirmed",
  "booking_cancelled",
  "quote_sent",
  "invoice_sent",
  "customer_message",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailVariable {
  name: string;
  description: string;
  sample: string;
}

export interface EmailTemplateDefaults {
  subject: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  footerExtraHtml?: string;
}

export interface EmailTemplateSummaryRow {
  label: string;
  value: string;
}

export interface EmailTemplateDef {
  key: EmailTemplateKey;
  family: EmailFamily;
  name: string;
  description: string;
  audience: "Your team" | "Customers";
  variables: EmailVariable[];
  defaults: EmailTemplateDefaults;
  cta?: { urlVariable: string };
  summary?: EmailTemplateSummaryRow[];
  // Customer messages are the user's own content; the Templates tab lists them but does not edit
  // them through this registry.
  editable?: boolean;
}

export const COMMON_VARIABLES: EmailVariable[] = [
  { name: "company.name", description: "Your company name", sample: "Northwind Studio" },
  { name: "app.url", description: "Your Dealflow address", sample: "https://app.example.com" },
  { name: "recipient.name", description: "The recipient's name", sample: "Mia Novak" },
  { name: "recipient.email", description: "The recipient's address", sample: "mia@example.com" },
];

function define(
  input: Omit<EmailTemplateDef, "variables"> & { variables: EmailVariable[] },
): EmailTemplateDef {
  return { ...input, variables: [...COMMON_VARIABLES, ...input.variables] };
}

const SIGN_IN: EmailTemplateDef = define({
  key: "sign_in_link",
  family: "product",
  name: "Sign-in link",
  description: "The one-time link someone receives when they ask to sign in.",
  audience: "Your team",
  variables: [
    {
      name: "link.url",
      description: "The one-time sign-in link",
      sample: "https://app.example.com/auth/magic/verify?token=sample",
    },
    { name: "link.expires_in", description: "How long the link lasts", sample: "15 minutes" },
  ],
  defaults: {
    subject: "Your Dealflow sign-in link",
    preheader: "This link works once and expires in 15 minutes.",
    bodyHtml:
      "<p>Hi {{recipient.name}},</p><p>Use the button below to sign in to Dealflow. The link works once and expires in {{link.expires_in}}.</p><p>If you didn't ask to sign in, you can ignore this email.</p>",
    ctaLabel: "Sign in",
  },
  cta: { urlVariable: "link.url" },
});

const INVITE: EmailTemplateDef = define({
  key: "invite",
  family: "product",
  name: "Invite",
  description: "The invitation an admin sends when adding a teammate.",
  audience: "Your team",
  variables: [
    { name: "inviter.name", description: "The admin who invited them", sample: "Alex Rivera" },
    {
      name: "link.url",
      description: "The set-password link",
      sample: "https://app.example.com/auth/invite/accept?token=sample",
    },
    { name: "link.expires_in", description: "How long the link lasts", sample: "7 days" },
  ],
  defaults: {
    subject: "{{inviter.name}} invited you to Dealflow",
    preheader: "Set your password to join {{company.name}} on Dealflow.",
    bodyHtml:
      "<p>Hi {{recipient.name}},</p><p>{{inviter.name}} has invited you to join {{company.name}} on Dealflow, the CRM your team uses for deals, contacts and email.</p><p>Set your password to get started. This link expires in {{link.expires_in}}.</p>",
    ctaLabel: "Set your password",
  },
  cta: { urlVariable: "link.url" },
});

const NOTIFICATION: EmailTemplateDef = define({
  key: "notification",
  family: "product",
  name: "Notification",
  description: "One template for every notification type, with its own subject and line.",
  audience: "Your team",
  variables: [
    {
      name: "notification.subject",
      description: "The notification's subject",
      sample: "Deal won!",
    },
    {
      name: "notification.line",
      description: "The notification's one-line description",
      sample: "Mia, a deal was marked as won.",
    },
    {
      name: "notification.cta",
      description: "The button label for this type",
      sample: "Open deal",
    },
    {
      name: "notification.url",
      description: "Where the notification points",
      sample: "https://app.example.com/pipeline/deal-sample",
    },
  ],
  defaults: {
    subject: "{{notification.subject}}",
    preheader: "{{notification.line}}",
    bodyHtml: "<p>Hi {{recipient.name}},</p><p>{{notification.line}}</p>",
    ctaLabel: "{{notification.cta}}",
    footerExtraHtml:
      'You get these emails because of your notification settings. <a href="{{app.url}}/settings/notifications">Change notification settings</a>.',
  },
  cta: { urlVariable: "notification.url" },
});

const BACKUP_FAILED: EmailTemplateDef = define({
  key: "backup_failed",
  family: "product",
  name: "Backup failed",
  description: "Warns every admin when a scheduled backup does not complete.",
  audience: "Your team",
  variables: [
    {
      name: "backup.time",
      description: "When the backup was due",
      sample: "23 Oct 2026, 02:00 UTC",
    },
    { name: "backup.error", description: "The failure reason", sample: "No space left on device" },
    {
      name: "backup.url",
      description: "The backups settings page",
      sample: "https://app.example.com/settings/backups",
    },
  ],
  defaults: {
    subject: "Dealflow backup failed",
    preheader: "The backup at {{backup.time}} did not complete.",
    bodyHtml:
      "<p>The scheduled backup at {{backup.time}} did not complete.</p><p>Reason: {{backup.error}}</p><p>Check the server's free disk space and the backup folder, then run a backup again from Settings.</p>",
    ctaLabel: "Open backups",
  },
  cta: { urlVariable: "backup.url" },
});

const WEBHOOK_DISABLED: EmailTemplateDef = define({
  key: "webhook_disabled",
  family: "product",
  name: "Webhook disabled",
  description: "Tells the subscription's creator that a webhook was turned off.",
  audience: "Your team",
  variables: [
    { name: "webhook.name", description: "The subscription name", sample: "CRM sync" },
    {
      name: "webhook.url",
      description: "The receiving URL",
      sample: "https://hooks.example.com/dealflow",
    },
    { name: "webhook.failures", description: "Failures in a row", sample: "12" },
    {
      name: "webhook.settings_url",
      description: "The webhooks settings page",
      sample: "https://app.example.com/settings/webhooks",
    },
  ],
  defaults: {
    subject: "A Dealflow webhook was disabled",
    preheader: "{{webhook.name}} stopped after {{webhook.failures}} failed deliveries.",
    bodyHtml:
      "<p>The webhook <strong>{{webhook.name}}</strong> ({{webhook.url}}) was turned off after {{webhook.failures}} deliveries in a row failed.</p><p>Fix the receiving service, then turn the webhook back on.</p>",
    ctaLabel: "Open webhooks",
  },
  cta: { urlVariable: "webhook.settings_url" },
});

const BOOKING_CONFIRMED: EmailTemplateDef = define({
  key: "booking_confirmed",
  family: "customer",
  name: "Booking confirmed",
  description: "The confirmation a guest receives after booking a slot.",
  audience: "Customers",
  variables: [
    { name: "guest.name", description: "The guest's name", sample: "Mia Novak" },
    { name: "host.name", description: "The host's name", sample: "Demo Admin" },
    { name: "booking.title", description: "The booking page title", sample: "Discovery call" },
    {
      name: "booking.when",
      description: "The local date and time",
      sample: "Mon 2 Nov 2026, 10:00",
    },
    { name: "booking.timezone", description: "The guest's time zone", sample: "Europe/London" },
    { name: "booking.duration", description: "The length", sample: "30 minutes" },
    { name: "booking.location", description: "Where it happens", sample: "Google Meet" },
    {
      name: "booking.cancel_url",
      description: "The guest's cancellation link",
      sample: "https://app.example.com/book/cancel/sample",
    },
  ],
  defaults: {
    subject: "Booked: {{booking.title}} with {{host.name}}",
    preheader: "{{booking.when}} · {{booking.duration}}",
    bodyHtml:
      "<p>Hi {{guest.name}},</p><p>Your {{booking.title}} with {{host.name}} is booked.</p><p><strong>When:</strong> {{booking.when}} ({{booking.timezone}})<br><strong>Length:</strong> {{booking.duration}}<br><strong>Where:</strong> {{booking.location}}</p><p>A calendar invite is attached.</p>",
    ctaLabel: "Cancel booking",
  },
  cta: { urlVariable: "booking.cancel_url" },
});

const BOOKING_CANCELLED: EmailTemplateDef = define({
  key: "booking_cancelled",
  family: "customer",
  name: "Booking cancelled",
  description: "The note a guest receives when a booking is cancelled.",
  audience: "Customers",
  variables: [
    { name: "guest.name", description: "The guest's name", sample: "Mia Novak" },
    { name: "host.name", description: "The host's name", sample: "Demo Admin" },
    { name: "booking.title", description: "The booking page title", sample: "Discovery call" },
    {
      name: "booking.when",
      description: "The local date and time",
      sample: "Mon 2 Nov 2026, 10:00",
    },
  ],
  defaults: {
    subject: "Cancelled: {{booking.title}} with {{host.name}}",
    preheader: "Your booking on {{booking.when}} is cancelled.",
    bodyHtml:
      "<p>Hi {{guest.name}},</p><p>Your {{booking.title}} with {{host.name}} on {{booking.when}} has been cancelled.</p>",
  },
});

const QUOTE_SENT: EmailTemplateDef = define({
  key: "quote_sent",
  family: "customer",
  name: "Quote sent",
  description: "Sends the customer their quote with a link to accept it.",
  audience: "Customers",
  variables: [
    { name: "customer.name", description: "The customer's name", sample: "Aria Reyes" },
    { name: "document.number", description: "The quote number", sample: "Q-2026-0003" },
    { name: "document.title", description: "The quote title", sample: "Website redesign" },
    { name: "document.total", description: "The total", sample: "£1,200.00" },
    { name: "document.valid_until", description: "The acceptance deadline", sample: "30 Nov 2026" },
    { name: "sender.name", description: "The person sending it", sample: "Demo Admin" },
    {
      name: "document.url",
      description: "The public quote link",
      sample: "https://app.example.com/d/sample",
    },
  ],
  defaults: {
    subject: "Quote {{document.number}} from {{company.name}}",
    preheader: "{{document.title}} · {{document.total}}",
    bodyHtml:
      "<p>Hi {{customer.name}},</p><p>Thank you for your interest. Your quote for {{document.title}} is ready to view. You can accept it online.</p><p>Best regards,<br>{{sender.name}}</p>",
    ctaLabel: "View quote",
  },
  cta: { urlVariable: "document.url" },
  summary: [
    { label: "Quote", value: "{{document.number}}" },
    { label: "Total", value: "{{document.total}}" },
    { label: "Valid until", value: "{{document.valid_until}}" },
  ],
});

const INVOICE_SENT: EmailTemplateDef = define({
  key: "invoice_sent",
  family: "customer",
  name: "Invoice sent",
  description: "Sends the customer their invoice with a link to view it.",
  audience: "Customers",
  variables: [
    { name: "customer.name", description: "The customer's name", sample: "Aria Reyes" },
    { name: "document.number", description: "The invoice number", sample: "INV-2026-0003" },
    { name: "document.title", description: "The invoice title", sample: "Website redesign" },
    { name: "document.total", description: "The total", sample: "£1,200.00" },
    { name: "document.due_date", description: "The payment due date", sample: "30 Nov 2026" },
    { name: "sender.name", description: "The person sending it", sample: "Demo Admin" },
    {
      name: "document.url",
      description: "The public invoice link",
      sample: "https://app.example.com/d/sample",
    },
  ],
  defaults: {
    subject: "Invoice {{document.number}} from {{company.name}}",
    preheader: "{{document.total}} due {{document.due_date}}",
    bodyHtml:
      "<p>Hi {{customer.name}},</p><p>Please find your invoice for {{document.title}} below. Payment details are on the invoice.</p><p>Best regards,<br>{{sender.name}}</p>",
    ctaLabel: "View invoice",
  },
  cta: { urlVariable: "document.url" },
  summary: [
    { label: "Invoice", value: "{{document.number}}" },
    { label: "Total", value: "{{document.total}}" },
    { label: "Due date", value: "{{document.due_date}}" },
  ],
});

const CUSTOMER_MESSAGE: EmailTemplateDef = define({
  key: "customer_message",
  family: "customer",
  name: "Your emails",
  description: "What people send from Dealflow. It is their content, wrapped in your layout.",
  audience: "Customers",
  variables: [],
  defaults: {
    subject: "Your message",
    preheader: "",
    bodyHtml: "<p>Your message.</p>",
  },
  editable: false,
});

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateDef> = {
  sign_in_link: SIGN_IN,
  invite: INVITE,
  notification: NOTIFICATION,
  backup_failed: BACKUP_FAILED,
  webhook_disabled: WEBHOOK_DISABLED,
  booking_confirmed: BOOKING_CONFIRMED,
  booking_cancelled: BOOKING_CANCELLED,
  quote_sent: QUOTE_SENT,
  invoice_sent: INVOICE_SENT,
  customer_message: CUSTOMER_MESSAGE,
};

export function isTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function sampleVariables(key: EmailTemplateKey): Record<string, string> {
  const def = EMAIL_TEMPLATES[key];
  const samples: Record<string, string> = {};
  for (const variable of def.variables) samples[variable.name] = variable.sample;
  return samples;
}
