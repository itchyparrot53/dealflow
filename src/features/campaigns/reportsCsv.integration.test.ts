import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as exportCsv } from "@/app/(app)/campaigns/[id]/report/recipients.csv/route";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { campaignEvents, campaignRecipients, campaigns, persons } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import { hashEmail } from "@/features/marketing/suppression";
import { hashMarketingToken } from "@/features/marketing/tokens";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";

let h: TestDb;
let currentActor: PermSetUser | null = null;
vi.mock("@/server/trpc/context", () => ({
  createContext: () => Promise.resolve({ actor: currentActor, session: { id: "test-session" } }),
}));
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

function actor(id: string, flags: PermissionFlagKey[]): PermSetUser {
  return { id, type: "regular", isActive: true, groupIds: new Set(), flags: new Set(flags) };
}

let campaignId = "";

beforeAll(async () => {
  h = await makeTestDb();
  const user = await seedUser(h.db, { isAdmin: false });
  const [person] = await h.db
    .insert(persons)
    .values({
      name: "Ada Person",
      primaryEmail: "ada@example.com",
      ownerId: user.id,
      visibilityLevel: "all",
    })
    .returning();
  if (person === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person insert failed");
  const [campaign] = await h.db
    .insert(campaigns)
    .values({
      name: "Export",
      type: "newsletter",
      status: "sent",
      subject: "Hello",
      createdBy: user.id,
      startedAt: new Date(),
    })
    .returning();
  if (campaign === undefined)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign insert failed");
  campaignId = campaign.id;
  const [recipient] = await h.db
    .insert(campaignRecipients)
    .values({
      campaignId: campaign.id,
      personId: person.id,
      email: "ada@example.com",
      emailHash: hashEmail("ada@example.com"),
      status: "sent",
      token: "token",
      tokenHash: hashMarketingToken("token"),
      sentAt: new Date(),
    })
    .returning({ id: campaignRecipients.id });
  if (recipient === undefined)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "recipient insert failed");
  await h.db.insert(campaignEvents).values({
    campaignId: campaign.id,
    recipientId: recipient.id,
    personId: person.id,
    type: "delivered",
  });
  currentActor = actor(user.id, ["campaigns.view", "data.export"]);
});

afterAll(async () => {
  await h.close();
});

describe("campaign recipients CSV route", () => {
  it("returns the visible recipients as an attachment", async () => {
    const response = await exportCsv(new NextRequest("http://localhost/"), {
      params: Promise.resolve({ id: campaignId }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("campaign-recipients-");
    const body = await response.text();
    expect(body.split("\r\n")[0]).toBe("Person,Email,Status,Last activity");
    expect(body).toContain("ada@example.com");
  });

  it("requires data.export", async () => {
    currentActor = actor("00000000-0000-4000-8000-000000000009", ["campaigns.view"]);
    const response = await exportCsv(new NextRequest("http://localhost/"), {
      params: Promise.resolve({ id: campaignId }),
    });
    expect(response.status).toBe(403);
  });

  it("requires a session", async () => {
    currentActor = null;
    const response = await exportCsv(new NextRequest("http://localhost/"), {
      params: Promise.resolve({ id: campaignId }),
    });
    expect(response.status).toBe(401);
  });
});
