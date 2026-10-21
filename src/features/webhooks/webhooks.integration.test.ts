import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { webhookDeliveries, webhookSubscriptions } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import { encryptToken } from "@/features/email/crypto";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { SystemMail } from "@/features/mailer/types";
import { makeTestDb } from "@/test/db";
import { ok } from "@/types/result";
import { deliverWebhook } from "./deliver";
import { verifySignature } from "./signature";

const SECRET = "whsec_test_secret";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let adminId: string;
const servers: Server[] = [];

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const admin = await seedUser(h.db, { isAdmin: true, name: "Webhook Admin" });
  adminId = admin.id;
}, 60_000);

afterAll(async () => {
  setSystemMailerForTest(null);
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(webhookSubscriptions);
  setSystemMailerForTest(null);
});

interface Receiver {
  url: string;
  requests: { headers: Record<string, string | string[] | undefined>; body: string }[];
}

async function startReceiver(
  handler: (request: { headers: Record<string, string | string[] | undefined>; body: string }, respond: (status: number, headers?: Record<string, string>) => void) => void,
): Promise<Receiver> {
  const requests: Receiver["requests"] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      requests.push({ headers: request.headers, body });
      handler({ headers: request.headers, body }, (status, headers) => {
        response.writeHead(status, headers);
        response.end("ok");
      });
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/hook`, requests };
}

async function seedSubscription(
  url: string,
  overrides: Partial<typeof webhookSubscriptions.$inferInsert> = {},
): Promise<string> {
  const [row] = await h.db
    .insert(webhookSubscriptions)
    .values({
      name: "Receiver",
      url,
      events: ["deal.won"],
      secretEnc: encryptToken(SECRET),
      createdBy: adminId,
      ...overrides,
    })
    .returning({ id: webhookSubscriptions.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "subscription seed failed");
  return row.id;
}

async function seedDelivery(
  subscriptionId: string,
  overrides: Partial<typeof webhookDeliveries.$inferInsert> = {},
): Promise<string> {
  const [row] = await h.db
    .insert(webhookDeliveries)
    .values({
      subscriptionId,
      eventType: "deal.won",
      payload: { id: "evt_1", type: "deal.won", data: { id: "deal-1", title: "Big deal" } },
      status: "pending",
      ...overrides,
    })
    .returning({ id: webhookDeliveries.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "delivery seed failed");
  return row.id;
}

async function loadDelivery(id: string) {
  const [row] = await h.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
  return row;
}

async function loadSubscription(id: string) {
  const [row] = await h.db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));
  return row;
}

describe("deliverWebhook", () => {
  it("marks a 200 succeeded and signs the body the receiver can verify", async () => {
    const receiver = await startReceiver((_request, respond) => respond(200));
    const subscriptionId = await seedSubscription(receiver.url);
    const deliveryId = await seedDelivery(subscriptionId);

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("succeeded");
    expect(outcome.statusCode).toBe(200);

    const request = receiver.requests[0];
    expect(request).toBeDefined();
    const header = request?.headers["x-dealflow-signature"];
    expect(typeof header).toBe("string");
    expect(
      verifySignature(SECRET, header as string, request?.body ?? "", Math.floor(Date.now() / 1000)),
    ).toBe(true);
    expect(request?.headers["x-dealflow-event"]).toBe("deal.won");
    expect(request?.headers["x-dealflow-delivery"]).toBe(deliveryId);

    const delivery = await loadDelivery(deliveryId);
    expect(delivery?.status).toBe("succeeded");
    const subscription = await loadSubscription(subscriptionId);
    expect(subscription?.consecutiveFailures).toBe(0);
    expect(subscription?.lastDeliveryAt).not.toBeNull();
  });

  it("marks a 500 retrying with the first backoff", async () => {
    const receiver = await startReceiver((_request, respond) => respond(500));
    const subscriptionId = await seedSubscription(receiver.url);
    const deliveryId = await seedDelivery(subscriptionId);

    const before = Date.now();
    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("retrying");

    const delivery = await loadDelivery(deliveryId);
    expect(delivery?.status).toBe("retrying");
    expect(delivery?.attempts).toBe(1);
    const wait = (delivery?.nextAttemptAt?.getTime() ?? 0) - before;
    expect(wait).toBeGreaterThan(55_000);
    expect(wait).toBeLessThan(65_000);
  });

  it("fails after the sixth failed attempt", async () => {
    const receiver = await startReceiver((_request, respond) => respond(500));
    const subscriptionId = await seedSubscription(receiver.url);
    const deliveryId = await seedDelivery(subscriptionId, { attempts: 5 });

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("failed");
    const delivery = await loadDelivery(deliveryId);
    expect(delivery?.status).toBe("failed");
    expect(delivery?.attempts).toBe(6);
    expect(delivery?.nextAttemptAt).toBeNull();
  });

  it("disables the subscription after ten consecutive failures and mails the creator once", async () => {
    const receiver = await startReceiver((_request, respond) => respond(503));
    const subscriptionId = await seedSubscription(receiver.url, { consecutiveFailures: 9 });
    const deliveryId = await seedDelivery(subscriptionId);
    const sent: SystemMail[] = [];
    setSystemMailerForTest({
      mode: "capture",
      send: (mail) => {
        sent.push(mail);
        return Promise.resolve(ok({ messageId: "m1" }));
      },
    });

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("retrying");
    const subscription = await loadSubscription(subscriptionId);
    expect(subscription?.enabled).toBe(false);
    expect(subscription?.disabledReason).toBe("Disabled after 10 failed deliveries");
    expect(sent).toHaveLength(1);
  });

  it("disables immediately on a 410", async () => {
    const receiver = await startReceiver((_request, respond) => respond(410));
    const subscriptionId = await seedSubscription(receiver.url);
    const deliveryId = await seedDelivery(subscriptionId);

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("failed");
    const subscription = await loadSubscription(subscriptionId);
    expect(subscription?.enabled).toBe(false);
    expect(subscription?.disabledReason).toBe("Receiver returned 410 Gone");
    const delivery = await loadDelivery(deliveryId);
    expect(delivery?.lastStatusCode).toBe(410);
  });

  it("does not follow a 302", async () => {
    const target = await startReceiver((_request, respond) => respond(200));
    const redirect = await startReceiver((_request, respond) =>
      respond(302, { location: target.url }),
    );
    const subscriptionId = await seedSubscription(redirect.url);
    const deliveryId = await seedDelivery(subscriptionId);

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("retrying");
    expect(outcome.statusCode).toBe(302);
    expect(redirect.requests).toHaveLength(1);
    expect(target.requests).toHaveLength(0);
  });

  it("times out a slow receiver", async () => {
    const receiver = await startReceiver((_request, respond) => {
      setTimeout(() => respond(200), 300);
    });
    const subscriptionId = await seedSubscription(receiver.url);
    const deliveryId = await seedDelivery(subscriptionId);

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), {
      allowPrivate: true,
      timeoutMs: 60,
    });
    expect(outcome.status).toBe("retrying");
    expect(outcome.errorId).toBe(ERROR_IDS.WEBHOOK_DELIVERY_FAILED);
    const delivery = await loadDelivery(deliveryId);
    expect(delivery?.lastError).toBe("request timed out");
  });

  it("refuses a loopback target before connecting when private targets are off", async () => {
    const receiver = await startReceiver((_request, respond) => respond(200));
    // https forces the scheme check to pass, so the refusal must come from the pinned lookup.
    const url = receiver.url.replace("http://", "https://");
    const subscriptionId = await seedSubscription(url);
    const deliveryId = await seedDelivery(subscriptionId);

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: false });
    expect(outcome.status).toBe("retrying");
    expect(outcome.errorId).toBe(ERROR_IDS.WEBHOOK_URL_REFUSED);
    expect(receiver.requests).toHaveLength(0);
  });

  it("marks the delivery failed when the subscription is disabled", async () => {
    const receiver = await startReceiver((_request, respond) => respond(200));
    const subscriptionId = await seedSubscription(receiver.url, {
      enabled: false,
      disabledReason: "Demo",
    });
    const deliveryId = await seedDelivery(subscriptionId, { eventId: 1 });

    const outcome = await deliverWebhook(h.db, deliveryId, sig(), { allowPrivate: true });
    expect(outcome.status).toBe("failed");
    expect(outcome.errorId).toBe(ERROR_IDS.WEBHOOK_DISABLED);
    expect(receiver.requests).toHaveLength(0);
  });

  it("is harmless for a missing delivery", async () => {
    const outcome = await deliverWebhook(h.db, randomUUID(), sig(), { allowPrivate: true });
    expect(outcome.status).toBe("failed");
    expect(outcome.errorId).toBe(ERROR_IDS.WEBHOOK_NOT_FOUND);
  });
});
