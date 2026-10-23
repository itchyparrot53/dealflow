import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { seedUser } from "@/db/testing/factories";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { SystemMail } from "@/features/mailer/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { sampleVariables } from "./registry";
import { sendSystemEmail } from "./sendSystemEmail";
import { resetTemplate, resolveTemplate, saveTemplate } from "./templates";

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;
let dir: string;

vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

function toActor(row: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function captured(): Promise<SystemMail[]> {
  const files = await readdir(dir);
  const mails: SystemMail[] = [];
  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    mails.push(JSON.parse(await readFile(join(dir, file), "utf8")) as SystemMail);
  }
  return mails;
}

beforeAll(async () => {
  h = await makeTestDb();
  admin = toActor(await seedUser(h.db, { isAdmin: true }));
  regular = toActor(await seedUser(h.db));
  dir = await mkdtemp(join(tmpdir(), "dealflow-email-"));
  setSystemMailerForTest(captureMailer(dir));
});

afterAll(async () => {
  setSystemMailerForTest(null);
  await rm(dir, { recursive: true, force: true });
  await h.close();
});

describe("template overrides", () => {
  it("saves an override, resolves it over the default, and reset deletes it", async () => {
    const saved = await saveTemplate(
      h.db,
      admin,
      "sign_in_link",
      {
        subject: "Your link is ready",
        preheader: "One click and you are in.",
        bodyHtml: "<p>Hello {{recipient.name}}, this is the override.</p>",
        ctaLabel: "Continue",
      },
      sig(),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.subject).toBe("Your link is ready");

    const resolved = await resolveTemplate(h.db, "sign_in_link", sig());
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.bodyHtml).toContain("this is the override");

    const reset = await resetTemplate(h.db, admin, "sign_in_link", sig());
    expect(reset.ok).toBe(true);
    if (reset.ok) expect(reset.value.subject).toBe("Your Dealflow sign-in link");
    const after = await resolveTemplate(h.db, "sign_in_link", sig());
    if (after.ok) expect(after.value.subject).toBe("Your Dealflow sign-in link");
  });

  it("rejects non-admins, unknown keys, over-length input and the non-editable key", async () => {
    const denied = await saveTemplate(
      h.db,
      regular,
      "invite",
      { subject: "Hi", preheader: null, bodyHtml: "<p>Hi</p>", ctaLabel: null },
      sig(),
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.id).toBe(ERROR_IDS.PERM_DENIED);

    const unknown = await saveTemplate(
      h.db,
      admin,
      "nope",
      { subject: "Hi", preheader: null, bodyHtml: "<p>Hi</p>", ctaLabel: null },
      sig(),
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.id).toBe(ERROR_IDS.EMAIL_DESIGN_TEMPLATE_UNKNOWN);

    const long = await saveTemplate(
      h.db,
      admin,
      "invite",
      { subject: "x".repeat(201), preheader: null, bodyHtml: "<p>Hi</p>", ctaLabel: null },
      sig(),
    );
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error.id).toBe(ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID);

    const own = await saveTemplate(
      h.db,
      admin,
      "customer_message",
      { subject: "Hi", preheader: null, bodyHtml: "<p>Hi</p>", ctaLabel: null },
      sig(),
    );
    expect(own.ok).toBe(false);
  });
});

describe("sendSystemEmail", () => {
  it("sends the notification template with the layout marker and List-Unsubscribe", async () => {
    const vars = { ...sampleVariables("notification"), "app.url": "https://app.example.com" };
    const sent = await sendSystemEmail(h.db, "notification", "mia@example.com", vars, sig());
    expect(sent.ok).toBe(true);
    const mails = await captured();
    const mail = mails.at(-1);
    expect(mail?.to).toBe("mia@example.com");
    expect(mail?.subject).toBe("Deal won!");
    expect(mail?.html).toContain('data-df-layout="product-branded"');
    expect(mail?.text).toContain("https://app.example.com/pipeline/deal-sample");
    expect(mail?.headers?.["List-Unsubscribe"]).toBe(
      "<https://app.example.com/settings/notifications>",
    );
  });

  it("passes attachments through to the mailer for customer booking mail", async () => {
    const vars = sampleVariables("booking_confirmed");
    const sent = await sendSystemEmail(
      h.db,
      "booking_confirmed",
      "guest@example.com",
      vars,
      sig(),
      {
        attachments: [
          {
            filename: "invite.ics",
            contentType: "text/calendar",
            content: "BEGIN:VCALENDAR\nEND:VCALENDAR",
          },
        ],
      },
    );
    expect(sent.ok).toBe(true);
    const mails = await captured();
    const mail = mails.at(-1);
    expect(mail?.html).toContain('data-df-layout="customer-branded"');
    expect(mail?.attachments?.[0]?.filename).toBe("invite.ics");
  });
});
