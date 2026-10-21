import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { FORM_MIN_FILL_MS, FORM_TOKEN_MAX_AGE_MS } from "@/constants/formsBooking";

// A form page embeds a signed "started at" token. The signature keeps a bot from choosing its own
// start time, and the fill-time floor filters instant posts. The webhook secret is the install's
// existing server HMAC secret; the prefix gives this signature its own namespace so a form token
// can never be a valid WebSocket ticket or vice versa.

const PURPOSE = "dealflow-form-token:";
const SIGNATURE_BYTES = 32;
const HEX_RE = /^[0-9a-f]{64}$/;

function sign(formPublicId: string, issued: number): string {
  return createHmac("sha256", `${PURPOSE}${env.WS_TICKET_SECRET}`)
    .update(`${formPublicId}.${issued}`)
    .digest("hex");
}

export type FormTokenCheck = "ok" | "too_fast" | "invalid";

export function issueFormToken(formPublicId: string, now: number): string {
  return `${now}.${sign(formPublicId, now)}`;
}

export function checkFormToken(formPublicId: string, token: string, now: number): FormTokenCheck {
  const dot = token.indexOf(".");
  if (dot <= 0) return "invalid";
  const issuedRaw = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (!/^\d{1,16}$/.test(issuedRaw) || !HEX_RE.test(given)) return "invalid";

  const issued = Number(issuedRaw);
  if (!Number.isSafeInteger(issued)) return "invalid";

  const expected = Buffer.from(sign(formPublicId, issued), "utf8");
  const actual = Buffer.from(given, "utf8");
  if (actual.length !== SIGNATURE_BYTES * 2 || !timingSafeEqual(expected, actual)) return "invalid";

  // A token from the future cannot come from a page this server rendered; treat it as forged.
  if (issued > now) return "invalid";
  const age = now - issued;
  if (age > FORM_TOKEN_MAX_AGE_MS) return "invalid";
  if (age < FORM_MIN_FILL_MS) return "too_fast";
  return "ok";
}
