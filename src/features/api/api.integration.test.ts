import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  activities,
  activityTypes,
  apiTokens,
  deals,
  domainEvents,
  persons,
  projectTasks,
  users,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { makeTestDb, type TestDb } from "@/test/db";
import { handleApiRequest, resetApiRateLimiterForTest } from "./handler";
import { newApiToken } from "./tokenFormat";
import type { ApiMethod } from "./types";

// The API pipeline against a real Postgres. Only the app pool binding is mocked, so the handler,
// the services it calls, the migrations and the SQL are all real.

let h: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

let adminId: string;
let regularId: string;
let otherId: string;
let pipelineId: string;
let firstStageId: string;
let secondStageId: string;
let callTypeId: string;

const json = async (res: Response): Promise<Record<string, unknown>> =>
  (await res.json()) as Record<string, unknown>;

async function call(
  method: ApiMethod,
  path: string,
  token?: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Headers; body: Record<string, unknown> }> {
  const request = new Request(`http://localhost/api/v1${path}`, {
    method,
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const segments =
    path
      .split("?")[0]
      ?.split("/")
      .filter((part) => part !== "") ?? [];
  const res = await handleApiRequest(request, method, segments);
  return { status: res.status, headers: res.headers, body: await json(res) };
}

async function issueToken(
  userId: string,
  scope: "read" | "write",
  overrides: Partial<typeof apiTokens.$inferInsert> = {},
): Promise<string> {
  const created = newApiToken();
  await h.db.insert(apiTokens).values({
    userId,
    name: `token-${Math.random().toString(36).slice(2, 8)}`,
    tokenHash: created.hash,
    tokenPrefix: created.prefix,
    scope,
    ...overrides,
  });
  return created.token;
}

async function seedDeal(opts: {
  ownerId: string;
  visibilityLevel?: "all" | "owner";
  title?: string;
}): Promise<string> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: opts.title ?? "API deal",
      pipelineId,
      stageId: firstStageId,
      ownerId: opts.ownerId,
      visibilityLevel: opts.visibilityLevel ?? "all",
      boardPosition: "0",
    })
    .returning({ id: deals.id });
  if (row === undefined) throw new Error("deal seed failed");
  return row.id;
}

beforeAll(async () => {
  h = await makeTestDb();
  adminId = (await seedUser(h.db, { isAdmin: true, name: "Ada Admin" })).id;
  regularId = (await seedUser(h.db, { name: "Rita Regular" })).id;
  otherId = (await seedUser(h.db, { name: "Otis Other" })).id;
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Propose", "Won"]);
  pipelineId = seeded.pipeline.id;
  firstStageId = seeded.stages[0]?.id ?? "";
  secondStageId = seeded.stages[1]?.id ?? "";
  const [type] = await h.db.select().from(activityTypes).limit(1);
  callTypeId = type?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(() => {
  resetApiRateLimiterForTest();
});

describe("API authentication and routing", () => {
  it("rejects a missing bearer token and a cookie-only request with E_API_001", async () => {
    const missing = await call("GET", "/deals");
    expect(missing.status).toBe(401);
    expect((missing.body.error as { id: string }).id).toBe(ERROR_IDS.API_TOKEN_MISSING);

    const cookie = await call("GET", "/deals", undefined, undefined, { cookie: "wd_session=abc" });
    expect(cookie.status).toBe(401);
    expect((cookie.body.error as { id: string }).id).toBe(ERROR_IDS.API_TOKEN_MISSING);
  });

  it("rejects a revoked, expired or inactive-user token with E_API_002", async () => {
    const revoked = await issueToken(adminId, "read", { revokedAt: new Date() });
    expect((await call("GET", "/deals", revoked)).status).toBe(401);

    const expired = await issueToken(adminId, "read", {
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await call("GET", "/deals", expired)).status).toBe(401);

    const inactiveId = (await seedUser(h.db, { name: "Inactive" })).id;
    await h.db.update(users).set({ isActive: false }).where(eq(users.id, inactiveId));
    const inactive = await issueToken(inactiveId, "read");
    const res = await call("GET", "/deals", inactive);
    expect(res.status).toBe(401);
    expect((res.body.error as { id: string }).id).toBe(ERROR_IDS.API_TOKEN_INVALID);
  });

  it("refuses a write with a read token", async () => {
    const token = await issueToken(adminId, "read");
    const res = await call("POST", "/deals", token, { title: "Nope" });
    expect(res.status).toBe(403);
    expect((res.body.error as { id: string }).id).toBe(ERROR_IDS.API_SCOPE_DENIED);
  });

  it("rate-limits the 121st call in a minute with Retry-After", async () => {
    const token = await issueToken(adminId, "read");
    for (let i = 0; i < 120; i += 1) {
      const res = await call("GET", "/deals?limit=1", token);
      expect(res.status).toBe(200);
    }
    const limited = await call("GET", "/deals?limit=1", token);
    expect(limited.status).toBe(429);
    expect((limited.body.error as { id: string }).id).toBe(ERROR_IDS.API_RATE_LIMITED);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("answers 404 for an unknown path and 405 for an unsupported method", async () => {
    const token = await issueToken(adminId, "read");
    const unknown = await call("GET", "/nope", token);
    expect(unknown.status).toBe(404);
    expect((unknown.body.error as { id: string }).id).toBe(ERROR_IDS.API_ROUTE_NOT_FOUND);

    const writeToken = await issueToken(adminId, "write");
    const wrongMethod = await call("PATCH", "/deals", writeToken, {});
    expect(wrongMethod.status).toBe(405);
  });

  it("returns 422 with Zod issues for an invalid body", async () => {
    const token = await issueToken(adminId, "write");
    const res = await call("POST", "/deals", token, { title: "" });
    expect(res.status).toBe(422);
    const error = res.body.error as { id: string; issues: unknown[] };
    expect(error.id).toBe(ERROR_IDS.API_BODY_INVALID);
    expect(error.issues.length).toBeGreaterThan(0);
  });
});

describe("deals", () => {
  it("lists with a cursor and filters by updated_since", async () => {
    const token = await issueToken(adminId, "read");
    await seedDeal({ ownerId: adminId, title: "First" });
    await seedDeal({ ownerId: adminId, title: "Second" });

    const page = await call("GET", "/deals?limit=1", token);
    expect(page.status).toBe(200);
    expect((page.body.data as unknown[]).length).toBe(1);
    expect(typeof page.body.nextCursor).toBe("string");

    const next = await call(`GET`, `/deals?limit=1&cursor=${String(page.body.nextCursor)}`, token);
    expect(next.status).toBe(200);
    expect((next.body.data as unknown[]).length).toBe(1);

    const since = await call(
      "GET",
      `/deals?updated_since=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`,
      token,
    );
    expect(since.status).toBe(200);
    expect(since.body.data).toEqual([]);
  });

  it("creates a deal, emits deal.created, patches the stage and soft-deletes it", async () => {
    const token = await issueToken(adminId, "write");
    const created = await call("POST", "/deals", token, {
      title: "API created",
      value: "1500.00",
      currency: "USD",
      pipelineId,
      stageId: firstStageId,
    });
    expect(created.status).toBe(201);
    const deal = created.body.data as {
      id: string;
      title: string;
      value: string;
      currency: string;
    };
    expect(deal.title).toBe("API created");
    expect(deal.value).toBe("1500.00");
    expect(deal.currency).toBe("USD");

    const events = await h.db
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.type, "deal.created"), eq(domainEvents.entityId, deal.id)));
    expect(events.length).toBeGreaterThanOrEqual(1);

    const patched = await call("PATCH", `/deals/${deal.id}`, token, { stageId: secondStageId });
    expect(patched.status).toBe(200);
    expect((patched.body.data as { stageId: string }).stageId).toBe(secondStageId);

    const removed = await call("DELETE", `/deals/${deal.id}`, token);
    expect(removed.status).toBe(200);
    const [row] = await h.db.select().from(deals).where(eq(deals.id, deal.id));
    expect(row?.deletedAt).not.toBeNull();

    const read = await call("GET", `/deals/${deal.id}`, token);
    expect(read.status).toBe(404);
  });

  it("hides a private deal of another owner from a regular user's token", async () => {
    const dealId = await seedDeal({ ownerId: regularId, visibilityLevel: "owner" });
    const ownerToken = await issueToken(regularId, "read");
    const otherToken = await issueToken(otherId, "read");

    expect((await call("GET", `/deals/${dealId}`, ownerToken)).status).toBe(200);
    const hidden = await call("GET", `/deals/${dealId}`, otherToken);
    expect(hidden.status).toBe(404);
    expect((hidden.body.error as { id: string }).id).toBe(ERROR_IDS.DEAL_NOT_FOUND);
  });
});

describe("persons, activities and projects", () => {
  it("lists and creates a person", async () => {
    const token = await issueToken(adminId, "write");
    const created = await call("POST", "/persons", token, {
      name: "Pat Person",
      emails: ["pat@example.com"],
      phones: ["+44 1234"],
    });
    expect(created.status).toBe(201);
    const person = created.body.data as { id: string; name: string };
    expect(person.name).toBe("Pat Person");

    const [row] = await h.db.select().from(persons).where(eq(persons.id, person.id));
    expect(row?.primaryEmail).toBe("pat@example.com");

    const listed = await call("GET", "/persons?limit=10", token);
    expect(listed.status).toBe(200);
    expect((listed.body.data as { id: string }[]).some((p) => p.id === person.id)).toBe(true);
  });

  it("lists and creates an activity", async () => {
    const token = await issueToken(adminId, "write");
    const dealId = await seedDeal({ ownerId: adminId });
    const created = await call("POST", "/activities", token, {
      typeId: callTypeId,
      subject: "API call",
      dealId,
    });
    expect(created.status).toBe(201);
    const activity = created.body.data as { id: string; subject: string };
    expect(activity.subject).toBe("API call");

    const [row] = await h.db.select().from(activities).where(eq(activities.id, activity.id));
    expect(row?.dealId).toBe(dealId);

    const listed = await call("GET", `/activities?dealId=${dealId}`, token);
    expect(listed.status).toBe(200);
    expect((listed.body.data as { id: string }[]).some((a) => a.id === activity.id)).toBe(true);
  });

  it("creates a project and a nested task", async () => {
    const token = await issueToken(adminId, "write");
    const created = await call("POST", "/projects", token, { name: "API project" });
    expect(created.status).toBe(201);
    const project = created.body.data as { id: string; phases: { id: string }[] };
    expect(project.phases).toHaveLength(3);

    const task = await call("POST", `/projects/${project.id}/tasks`, token, {
      title: "First task",
      phaseId: project.phases[0]?.id,
    });
    expect(task.status).toBe(201);
    expect((task.body.data as { title: string }).title).toBe("First task");

    const rows = await h.db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, project.id));
    expect(rows).toHaveLength(1);

    const tasks = await call("GET", `/projects/${project.id}/tasks`, token);
    expect(tasks.status).toBe(200);
    expect((tasks.body.data as unknown[]).length).toBe(1);
  });
});
