import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, resetFormRateLimitForTest } from "@/app/api/public/forms/[publicId]/submit/route";
import {
  automationRuns,
  automations,
  deals,
  domainEvents,
  leads,
  notes,
  notifications,
  organizations,
  personMarketing,
  persons,
  webFormSubmissions,
  webForms,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { runAutomation } from "@/features/automations/runner";
import { dispatchEvents } from "@/features/events/dispatcher";
import { issueFormToken } from "@/features/forms/spamToken";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { publicJsonHeaders } from "@/test/publicRequest";
import { createForm, setFormActive, type WebForm } from "./forms";

// The public route binds the app's shared pool when it is imported, so the test points that
// binding at its per-test database instead. It is still a real Drizzle client over real Postgres
// (Testcontainers); only the connection string is swapped.
let h: TestDb;
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

let admin: PermSetUser;
let adminId: string;
let pipelineId: string;
let stageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

const NAME = { key: "name", label: "Name", required: true, placeholder: null } as const;
const EMAIL = { key: "email", label: "Email", required: true, placeholder: null } as const;
const ORG = {
  key: "organization",
  label: "Organization",
  required: false,
  placeholder: null,
} as const;
const MESSAGE = { key: "message", label: "Message", required: false, placeholder: null } as const;

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true, name: "Form Owner" });
  adminId = adminRow.id;
  admin = { id: adminRow.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  const seeded = await seedPipelineWithStages(h.db, ["Incoming", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(automationRuns);
  await h.db.delete(automations);
  await h.db.delete(domainEvents);
  await h.db.delete(notifications);
  await h.db.delete(webFormSubmissions);
  await h.db.delete(webForms);
  await h.db.delete(notes);
  await h.db.delete(leads);
  await h.db.delete(deals);
  await h.db.delete(persons);
  await h.db.delete(organizations);
  resetFormRateLimitForTest();
});

async function createTestForm(over: Record<string, unknown> = {}): Promise<WebForm> {
  const result = await createForm(
    h.db,
    admin,
    {
      name: "Website enquiry",
      title: "Contact us",
      fields: [NAME, EMAIL, ORG, MESSAGE],
      creates: "lead",
      ownerId: adminId,
      successMessage: "Thanks, we will be in touch.",
      ...over,
    },
    sig(),
  );
  if (!result.ok) throw new Error(`createForm failed: ${result.error.id}`);
  return result.value;
}

interface SubmitBody {
  values: Record<string, unknown>;
  website?: string;
  token: string;
}

async function post(publicId: string, body: SubmitBody, ip = "203.0.113.7"): Promise<Response> {
  const request = new NextRequest(`http://localhost/api/public/forms/${publicId}/submit`, {
    method: "POST",
    headers: publicJsonHeaders(ip),
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ publicId }) });
}

function freshToken(publicId: string, ageMs = 2500): string {
  return issueFormToken(publicId, Date.now() - ageMs);
}

describe("public form submit", () => {
  it("creates person, organization, lead and note, records the submission and notifies the owner", async () => {
    const form = await createTestForm();
    const res = await post(form.publicId, {
      values: {
        name: "Riley Chen",
        email: "riley.chen@example.com",
        organization: "Chen Studio",
        message: "We need a CRM.",
      },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(body.message).toBe("Thanks, we will be in touch.");

    const people = await h.db.select().from(persons);
    expect(people).toHaveLength(1);
    expect(people[0]?.name).toBe("Riley Chen");
    expect(people[0]?.primaryEmail).toBe("riley.chen@example.com");

    const orgs = await h.db.select().from(organizations);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.name).toBe("Chen Studio");
    expect(people[0]?.orgId).toBe(orgs[0]?.id);

    const leadRows = await h.db.select().from(leads);
    expect(leadRows).toHaveLength(1);
    expect(leadRows[0]?.title).toBe("Riley Chen via Website enquiry");
    expect(leadRows[0]?.sourceOrigin).toBe("web_form");
    expect(leadRows[0]?.ownerId).toBe(adminId);
    expect(leadRows[0]?.personId).toBe(people[0]?.id);

    const noteRows = await h.db.select().from(notes);
    expect(noteRows).toHaveLength(1);
    expect(noteRows[0]?.entityType).toBe("lead");
    expect(noteRows[0]?.entityId).toBe(leadRows[0]?.id);
    expect(noteRows[0]?.body).toContain("We need a CRM.");

    const submissions = await h.db.select().from(webFormSubmissions);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.leadId).toBe(leadRows[0]?.id);
    expect(submissions[0]?.personId).toBe(people[0]?.id);

    const [reloaded] = await h.db.select().from(webForms).where(eq(webForms.id, form.id));
    expect(reloaded?.submissionCount).toBe(1);

    const events = await h.db.select().from(domainEvents);
    const formEvent = events.find((event) => event.type === "form.submitted");
    expect(formEvent).toBeDefined();
    expect(formEvent?.entityId).toBe(leadRows[0]?.id);

    const notifs = await h.db.select().from(notifications);
    expect(notifs.some((n) => n.type === "form_submission" && n.userId === adminId)).toBe(true);
  });

  it("reuses the person for the same email in a different case", async () => {
    const form = await createTestForm();
    const token = freshToken(form.publicId);
    await post(form.publicId, {
      values: { name: "Riley Chen", email: "riley.chen@example.com" },
      token,
    });
    const second = await post(form.publicId, {
      values: { name: "Riley Chen", email: "RILEY.CHEN@EXAMPLE.COM" },
      token,
    });
    expect(second.status).toBe(200);

    const people = await h.db.select().from(persons);
    expect(people).toHaveLength(1);
    const leadRows = await h.db.select().from(leads);
    expect(leadRows).toHaveLength(2);
    expect(leadRows.every((lead) => lead.personId === people[0]?.id)).toBe(true);
  });

  it("creates a deal in the chosen stage when the form creates deals", async () => {
    const form = await createTestForm({
      name: "Deal enquiry",
      creates: "deal",
      pipelineId,
      stageId,
    });
    const res = await post(form.publicId, {
      values: {
        name: "Riley Chen",
        email: "riley.chen@example.com",
        organization: "Chen Studio",
      },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(200);
    const dealRows = await h.db.select().from(deals);
    expect(dealRows).toHaveLength(1);
    expect(dealRows[0]?.title).toBe("Chen Studio via Deal enquiry");
    expect(dealRows[0]?.pipelineId).toBe(pipelineId);
    expect(dealRows[0]?.stageId).toBe(stageId);
    expect(dealRows[0]?.ownerId).toBe(adminId);

    const submissions = await h.db.select().from(webFormSubmissions);
    expect(submissions[0]?.dealId).toBe(dealRows[0]?.id);
  });

  it("accepts a honeypot or too-fast submission silently and writes nothing", async () => {
    const form = await createTestForm();
    const honeypot = await post(form.publicId, {
      values: { name: "Bot", email: "bot@example.com" },
      website: "https://spam.example",
      token: freshToken(form.publicId),
    });
    expect(honeypot.status).toBe(200);
    expect(((await honeypot.json()) as { ok: boolean }).ok).toBe(true);

    const tooFast = await post(form.publicId, {
      values: { name: "Speedy", email: "speedy@example.com" },
      token: freshToken(form.publicId, 100),
    });
    expect(tooFast.status).toBe(200);
    expect(((await tooFast.json()) as { ok: boolean }).ok).toBe(true);

    expect(await h.db.select().from(webFormSubmissions)).toHaveLength(0);
    expect(await h.db.select().from(persons)).toHaveLength(0);
    expect(await h.db.select().from(leads)).toHaveLength(0);
    expect(await h.db.select().from(domainEvents)).toHaveLength(0);
  });

  it("answers 422 with field errors for an invalid email and writes nothing", async () => {
    const form = await createTestForm();
    const res = await post(form.publicId, {
      values: { name: "Riley", email: "not-an-email" },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: string;
      fieldErrors: Record<string, string>;
    };
    expect(body.error).toBe("E_FORM_003");
    expect(body.fieldErrors.email).toBeDefined();
    expect(await h.db.select().from(persons)).toHaveLength(0);
    expect(await h.db.select().from(webFormSubmissions)).toHaveLength(0);
  });

  it("answers 404 for an inactive form", async () => {
    const form = await createTestForm();
    await setFormActive(h.db, admin, form.id, false, sig());
    const res = await post(form.publicId, {
      values: { name: "Riley", email: "riley@example.com" },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(404);
  });

  it("answers 429 on the eleventh submission in a minute", async () => {
    const form = await createTestForm();
    const token = freshToken(form.publicId);
    for (let i = 0; i < 10; i += 1) {
      const res = await post(form.publicId, {
        values: { name: `Visitor ${i}`, email: `visitor${i}@example.com` },
        token,
      });
      expect(res.status, `submission ${i}`).toBe(200);
    }
    const eleventh = await post(form.publicId, {
      values: { name: "Visitor 11", email: "visitor11@example.com" },
      token,
    });
    expect(eleventh.status).toBe(429);
    expect(((await eleventh.json()) as { error: string }).error).toBe("E_FORM_004");
  });

  it("runs an automation whose trigger is form.submitted", async () => {
    const form = await createTestForm({
      name: "Automation form",
      creates: "deal",
      pipelineId,
      stageId,
      fields: [NAME, EMAIL],
    });
    const automation = await createFormAutomation();
    await post(form.publicId, {
      values: { name: "Riley Chen", email: "riley.chen@example.com" },
      token: freshToken(form.publicId),
    });

    await dispatchEvents(h.db, sig());
    const running = await h.db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(eq(automationRuns.automationId, automation.id), eq(automationRuns.status, "running")),
      );
    expect(running.length).toBeGreaterThan(0);
    for (const run of running) await runAutomation(h.db, run.id, sig());

    const [finished] = await h.db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automation.id));
    expect(finished?.status).toBe("succeeded");
  });
});

async function createFormAutomation(): Promise<{ id: string }> {
  const { createAutomation } = await import("@/features/automations/service");
  const result = await createAutomation(
    h.db,
    admin,
    {
      name: "Form follow-up",
      definition: {
        trigger: { type: "form.submitted" },
        condition: null,
        actions: [{ type: "add_note", body: "Submitted through the website." }],
      },
      enabled: true,
    },
    sig(),
  );
  if (!result.ok) throw new Error(`createAutomation failed: ${result.error.id}`);
  return { id: result.value.id };
}

// The route is the only place the public id is trusted; a missing form and an inactive one must be
// indistinguishable, so the 404 case above uses an id that exists but is switched off.
describe("public form route input handling", () => {
  it("rejects an unknown public id", async () => {
    const res = await post("does-not-exist", {
      values: { name: "Riley", email: "riley@example.com" },
      token: issueFormToken("does-not-exist", Date.now() - 2500),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a body over the size cap", async () => {
    const form = await createTestForm();
    const huge = "x".repeat(70_000);
    const res = await post(form.publicId, {
      values: { name: "Riley", email: "riley@example.com", message: huge },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(413);
  });
});

describe("form marketing consent", () => {
  const CONSENT = {
    key: "marketing_consent",
    label: "I'd like to receive news and offers by email.",
    required: false,
    placeholder: null,
  } as const;

  it("sets a consenting visitor to pending and sends one double opt-in email", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dealflow-form-doi-"));
    setSystemMailerForTest(captureMailer(dir));
    try {
      const form = await createTestForm({ fields: [NAME, EMAIL, CONSENT] });
      const res = await post(form.publicId, {
        values: { name: "Ada Lovelace", email: "ada@example.com", marketing_consent: "on" },
        token: freshToken(form.publicId),
      });
      expect(res.status).toBe(200);

      const [person] = await h.db.select().from(persons);
      const [marketing] = await h.db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, person!.id));
      expect(marketing?.status).toBe("pending");

      const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
      expect(files).toHaveLength(1);
    } finally {
      setSystemMailerForTest(null);
    }
  });

  it("leaves the status alone when the box is unticked", async () => {
    const form = await createTestForm({ fields: [NAME, EMAIL, CONSENT] });
    const res = await post(form.publicId, {
      values: { name: "Grace Hopper", email: "grace@example.com" },
      token: freshToken(form.publicId),
    });
    expect(res.status).toBe(200);
    const [person] = await h.db.select().from(persons);
    const marketing = await h.db
      .select()
      .from(personMarketing)
      .where(eq(personMarketing.personId, person!.id));
    expect(marketing).toHaveLength(0);
  });
});
