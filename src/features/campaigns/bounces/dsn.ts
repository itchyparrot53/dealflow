import { type ParsedMail, simpleParser } from "mailparser";

// 6.8's asynchronous bounce parser. It understands the two multipart/report shapes a bounce
// mailbox receives: a delivery-status report (Gmail, Outlook, Postfix) and an ARF feedback report.
// The original message's headers are the join key: X-Dealflow-Campaign names the campaign and the
// deterministic Message-ID carries the recipient id.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_ID_PAIR = /<([0-9a-f-]{36})\.([0-9a-f-]{36})@/i;

export type BounceSeverity = "hard" | "soft";

export interface BounceReport {
  kind: "bounce" | "complaint";
  severity: BounceSeverity | null;
  campaignId: string | null;
  recipientId: string | null;
  recipientEmail: string | null;
  status: string | null;
  diagnostic: string | null;
  feedbackType: string | null;
}

function headerString(parsed: ParsedMail, name: string): string | null {
  const value = parsed.headers.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// mailparser returns Content-Type as a structured value, not a string, so its params (including
// report-type) live on `.params` rather than in the text.
function contentTypeOf(parsed: ParsedMail): string {
  const value: unknown = parsed.headers.get("content-type");
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";
  const shaped = value as { value?: unknown; params?: Record<string, unknown> };
  const base = typeof shaped.value === "string" ? shaped.value : "";
  const params = Object.entries(shaped.params ?? {})
    .map(([key, entry]) => `${key}=${String(entry)}`)
    .join("; ");
  return params === "" ? base : `${base}; ${params}`;
}

function reportType(contentType: string): "delivery-status" | "feedback-report" | null {
  if (/report-type\s*=\s*"?delivery-status"?/i.test(contentType)) return "delivery-status";
  if (/report-type\s*=\s*"?feedback-report"?/i.test(contentType)) return "feedback-report";
  return null;
}

function firstToEmail(parsed: ParsedMail): string | null {
  const list = parsed.to;
  if (list === undefined) return null;
  const values = Array.isArray(list) ? list : [list];
  for (const entry of values) {
    const address = entry.value[0]?.address;
    if (address !== undefined && address.trim() !== "") return address.trim().toLowerCase();
  }
  return null;
}

function originalMessage(parsed: ParsedMail): Buffer | null {
  const part = parsed.attachments.find((attachment) => attachment.contentType === "message/rfc822");
  return part?.content ?? null;
}

interface DeliveryStatusResult {
  recipientEmail: string | null;
  action: string | null;
  status: string | null;
  diagnostic: string | null;
}

function cleanRecipient(value: string | undefined): string | null {
  if (value === undefined) return null;
  const afterSemicolon = value.includes(";") ? value.slice(value.indexOf(";") + 1) : value;
  const trimmed = afterSemicolon.trim().replace(/^<|>$/g, "").toLowerCase();
  return trimmed === "" || !trimmed.includes("@") ? null : trimmed;
}

// The delivery-status fields arrive in `parsed.text` (mailparser flattens the message/report
// parts). A blank line separates the per-recipient blocks, and a folded Diagnostic-Code continues
// on an indented line.
function parseDeliveryStatus(text: string): DeliveryStatusResult[] {
  const results: DeliveryStatusResult[] = [];
  let current: Record<string, string> = {};
  let lastKey: string | null = null;

  const flush = (): void => {
    if (Object.keys(current).length > 0) {
      results.push({
        recipientEmail: cleanRecipient(current["final-recipient"] ?? current["original-recipient"]),
        action: current.action ?? null,
        status: current.status ?? null,
        diagnostic: current["diagnostic-code"] ?? null,
      });
    }
    current = {};
    lastKey = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^\s/.test(line) && lastKey !== null) {
      current[lastKey] = `${current[lastKey] ?? ""} ${line.trim()}`;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    current[key] = line.slice(separator + 1).trim();
    lastKey = key;
  }
  flush();
  return results;
}

function severityFor(status: string | null): BounceSeverity | null {
  if (status === null) return null;
  if (status.startsWith("5")) return "hard";
  if (status.startsWith("4")) return "soft";
  return null;
}

function feedbackField(text: string, field: string): string | null {
  const match = new RegExp(`^${field}:\\s*(.+)$`, "im").exec(text);
  return match?.[1]?.trim() ?? null;
}

async function originalHeaders(
  parsed: ParsedMail,
): Promise<{ campaignId: string | null; recipientId: string | null; email: string | null }> {
  const raw = originalMessage(parsed);
  if (raw === null) return { campaignId: null, recipientId: null, email: null };
  const original = await simpleParser(raw);
  const campaignHeader = headerString(original, "x-dealflow-campaign");
  const campaignId =
    campaignHeader !== null && UUID.test(campaignHeader) ? campaignHeader.toLowerCase() : null;
  const messageId = headerString(original, "message-id");
  const pair = messageId === null ? null : MESSAGE_ID_PAIR.exec(messageId);
  const recipientId = pair?.[2]?.toLowerCase() ?? null;
  return { campaignId, recipientId, email: firstToEmail(original) };
}

export async function parseBounceReport(raw: Buffer): Promise<BounceReport | null> {
  const parsed = await simpleParser(raw);
  const contentType = contentTypeOf(parsed);
  const type = reportType(contentType);
  if (type === null) return null;

  const original = await originalHeaders(parsed);
  const text = parsed.text ?? "";

  if (type === "feedback-report") {
    // mailparser keeps message/feedback-report as its own part, not in `text`, so read that part
    // first and fall back to the human text for providers that inline it.
    const feedbackPart = parsed.attachments.find(
      (attachment) => attachment.contentType === "message/feedback-report",
    );
    const feedbackText = feedbackPart?.content.toString("utf8") ?? text;
    return {
      kind: "complaint",
      severity: null,
      campaignId: original.campaignId,
      recipientId: original.recipientId,
      recipientEmail: feedbackField(feedbackText, "Original-Rcpt-To") ?? original.email,
      status: null,
      diagnostic: null,
      feedbackType: feedbackField(feedbackText, "Feedback-Type"),
    };
  }

  const results = parseDeliveryStatus(text);
  const first = results.find((result) => result.status !== null) ?? results[0];
  if (first === undefined) {
    return {
      kind: "bounce",
      severity: null,
      campaignId: original.campaignId,
      recipientId: original.recipientId,
      recipientEmail: original.email,
      status: null,
      diagnostic: null,
      feedbackType: null,
    };
  }
  return {
    kind: "bounce",
    severity: severityFor(first.status),
    campaignId: original.campaignId,
    recipientId: original.recipientId,
    recipientEmail: first.recipientEmail ?? original.email,
    status: first.status,
    diagnostic: first.diagnostic,
    feedbackType: null,
  };
}
