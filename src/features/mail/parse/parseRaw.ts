import { type ParsedMail, simpleParser } from "mailparser";
import { normalizeMessageId, syntheticMessageId } from "./messageId";
import type { ParsedMailMessage } from "./types";

export interface ParseOptions {
  // The mailbox's own address; a message from it is outbound.
  ownAddress: string;
  // Optional cap on the stored body sizes (a very large HTML body is not worth 10 MB of row).
  maxBodyChars?: number;
}

const PREVIEW_TEXT = "This message is too large to preview here. Open it in your mail app.";
const SNIPPET_CHARS = 200;

function addressList(list: ParsedMail["to"]): string[] {
  if (list === undefined) return [];
  const values = Array.isArray(list) ? list : [list];
  const out: string[] = [];
  for (const entry of values) {
    for (const item of entry.value) {
      const email = item.address?.trim().toLowerCase() ?? "";
      if (email !== "") out.push(email);
    }
  }
  return out;
}

function firstAddress(from: ParsedMail["from"]): { email: string; name: string | null } {
  const item = from?.value[0];
  const name = item?.name.trim() ?? "";
  return {
    email: item?.address?.trim().toLowerCase() ?? "",
    name: name === "" ? null : name,
  };
}

function normalizeReferences(value: ParsedMail["references"]): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : value.split(/\s+/);
  const out: string[] = [];
  for (const part of list) {
    const normalized = normalizeMessageId(part);
    if (normalized !== null && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

// Plain text of an HTML body for the list preview when the message has no text part.
function textFromHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function snippetOf(text: string | null): string | null {
  if (text === null) return null;
  const value = collapse(text);
  return value === "" ? null : value.slice(0, SNIPPET_CHARS);
}

function attachmentsOf(parsed: ParsedMail): ParsedMailMessage["attachments"] {
  const out: ParsedMailMessage["attachments"] = [];
  parsed.attachments.forEach((attachment, index) => {
    const filename = attachment.filename?.trim() ?? "";
    const isAttachment =
      attachment.contentDisposition === "attachment" ||
      (filename !== "" && attachment.related !== true);
    if (!isAttachment) return;
    out.push({
      providerAttachmentId: `idx:${index}`,
      filename: filename === "" ? `attachment-${index}` : filename,
      mimeType: attachment.contentType,
      sizeBytes: attachment.size,
    });
  });
  return out;
}

function mapParsed(
  parsed: ParsedMail,
  args: { ownAddress: string; size: number; maxBodyChars?: number },
): ParsedMailMessage {
  const from = firstAddress(parsed.from);
  const toEmails = addressList(parsed.to);
  const ccEmails = addressList(parsed.cc);
  const subject = parsed.subject ?? null;
  const sentAt = parsed.date ?? null;
  const rfc822 = normalizeMessageId(parsed.messageId);
  const providerMessageId =
    rfc822 ??
    syntheticMessageId({
      from: from.email,
      date: sentAt?.toISOString() ?? "",
      subject: subject ?? "",
      size: args.size,
    });

  let bodyText =
    parsed.text ?? (typeof parsed.html === "string" ? textFromHtml(parsed.html) : null);
  let bodyHtml = typeof parsed.html === "string" ? parsed.html : null;
  if (args.maxBodyChars !== undefined) {
    if (bodyText !== null) bodyText = bodyText.slice(0, args.maxBodyChars);
    if (bodyHtml !== null) bodyHtml = bodyHtml.slice(0, args.maxBodyChars);
  }

  const participants: string[] = [];
  for (const email of [from.email, ...toEmails, ...ccEmails]) {
    if (email !== "" && !participants.includes(email)) participants.push(email);
  }

  return {
    providerMessageId,
    rfc822MessageId: rfc822 ?? providerMessageId,
    inReplyTo: normalizeMessageId(parsed.inReplyTo),
    references: normalizeReferences(parsed.references),
    fromEmail: from.email,
    fromName: from.name,
    toEmails,
    ccEmails,
    subject,
    snippet: snippetOf(bodyText),
    bodyHtml,
    bodyText,
    sentAt,
    participants,
    direction:
      from.email !== "" && from.email === args.ownAddress.trim().toLowerCase()
        ? "outbound"
        : "inbound",
    attachments: attachmentsOf(parsed),
  };
}

// Full parse of one RFC 822 message. The caller decides whether the size is acceptable; this
// never truncates the source.
export async function parseRawMessage(raw: Buffer, opts: ParseOptions): Promise<ParsedMailMessage> {
  const parsed = await simpleParser(raw);
  return mapParsed(parsed, {
    ownAddress: opts.ownAddress,
    size: raw.length,
    ...(opts.maxBodyChars !== undefined ? { maxBodyChars: opts.maxBodyChars } : {}),
  });
}

// Headers-only shape for a message above MAIL_MAX_MESSAGE_BYTES: ids and subject are real, the
// body is a fixed preview, and there are no attachments to download at an unknown offset.
export async function parseTooLarge(
  headerBytes: Buffer,
  size: number,
  opts: ParseOptions,
): Promise<ParsedMailMessage> {
  const parsed = await simpleParser(headerBytes);
  const mapped = mapParsed(parsed, { ownAddress: opts.ownAddress, size });
  return {
    ...mapped,
    bodyText: PREVIEW_TEXT,
    bodyHtml: null,
    snippet: PREVIEW_TEXT,
    attachments: [],
  };
}
