import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Webhook signing. Receivers get `t=<unix seconds>,v1=<hex>` and verify an HMAC over
// `${timestamp}.${body}`, so a captured payload cannot be replayed with a new timestamp and a
// tampered body fails. verifySignature exists for receivers and for our own tests; the
// delivery job only signs.

const DEFAULT_TOLERANCE_SECONDS = 300;

export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function signatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signPayload(secret, timestamp, body)}`;
}

export function verifySignature(
  secret: string,
  header: string,
  body: string,
  nowSeconds: number,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  const parts = header.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signaturePart = parts.find((part) => part.startsWith("v1="));
  if (timestampPart === undefined || signaturePart === undefined) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = Buffer.from(signPayload(secret, timestamp, body), "hex");
  const given = Buffer.from(signaturePart.slice(3), "hex");
  // A malformed hex string decodes to fewer bytes; length is checked before the constant-time
  // compare, which throws on a length mismatch.
  if (expected.length === 0 || expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}
