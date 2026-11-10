import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as clickRoute } from "@/app/t/c/l/[token]/[n]/route";
import { GET as pixelRoute } from "@/app/t/c/o/[token]/route";
import { env } from "@/config/env";
import { resetRateLimitsForTest } from "@/server/rateLimitGuard";
import { makeTestDb, type TestDb } from "@/test/db";
import { eventsFor, seedTrackingCampaign } from "./testFixtures";

// The route handlers import the `db` singleton, so point it at this suite's test database the same
// way the other route integration tests do.
let h: TestDb;
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

function pixelRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/t/c/o/${token}.gif`, {
    headers: { "user-agent": "Mozilla/5.0 Chrome/120.0" },
  });
}

function clickRequest(token: string, index: string, query = ""): NextRequest {
  return new NextRequest(`http://localhost/t/c/l/${token}/${index}${query}`, {
    headers: { "user-agent": "Mozilla/5.0 Chrome/120.0" },
  });
}

beforeAll(async () => {
  h = await makeTestDb();
});

afterAll(async () => {
  await h.close();
});

describe("campaign tracking routes", () => {
  beforeEach(() => {
    resetRateLimitsForTest();
  });

  it("returns a 1x1 GIF, noindex and records one open per hit", async () => {
    const { campaign, recipient } = await seedTrackingCampaign(h.db);
    const token = recipient.token ?? "";

    const first = await pixelRoute(pixelRequest(token), {
      params: Promise.resolve({ token: `${token}.gif` }),
    });
    const second = await pixelRoute(pixelRequest(token), {
      params: Promise.resolve({ token: `${token}.gif` }),
    });

    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/gif");
    expect(first.headers.get("x-robots-tag")).toBe("noindex");
    expect((await first.arrayBuffer()).byteLength).toBeGreaterThan(0);

    expect(second.status).toBe(200);
    const opens = (await eventsFor(h.db, campaign.id)).filter((event) => event.type === "open");
    expect(opens).toHaveLength(2);
  });

  it("redirects to the stored target and ignores a URL in the query string", async () => {
    const { campaign, recipient } = await seedTrackingCampaign(h.db);
    const token = recipient.token ?? "";

    const response = await clickRoute(clickRequest(token, "0", "?url=https://evil.example/phish"), {
      params: Promise.resolve({ token, n: "0" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/");
    expect(response.headers.get("location")).not.toContain("evil.example");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");

    const clicks = (await eventsFor(h.db, campaign.id)).filter((event) => event.type === "click");
    expect(clicks).toHaveLength(1);
  });

  it("redirects an unknown token or link index to BASE_URL", async () => {
    const { recipient } = await seedTrackingCampaign(h.db);
    const token = recipient.token ?? "";

    const unknownIndex = await clickRoute(clickRequest(token, "99"), {
      params: Promise.resolve({ token, n: "99" }),
    });
    expect(unknownIndex.status).toBe(302);
    expect(unknownIndex.headers.get("location")).toBe(`${env.BASE_URL}/`);

    const unknownToken = await clickRoute(clickRequest("nope-not-a-token", "0"), {
      params: Promise.resolve({ token: "nope-not-a-token", n: "0" }),
    });
    expect(unknownToken.status).toBe(302);
    expect(unknownToken.headers.get("location")).toBe(`${env.BASE_URL}/`);
  });

  it("still returns the pixel for an unknown token, never a 500", async () => {
    const { campaign } = await seedTrackingCampaign(h.db);
    const response = await pixelRoute(pixelRequest("nope-not-a-token"), {
      params: Promise.resolve({ token: "nope-not-a-token.gif" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    const opens = (await eventsFor(h.db, campaign.id)).filter((event) => event.type === "open");
    expect(opens).toHaveLength(0);
  });
});
