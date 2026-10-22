import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { webhookDeliveries, webhookSubscriptions } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import { encryptToken } from "@/features/email/crypto";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { SystemMail } from "@/features/mailer/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { ok } from "@/types/result";
import { deliverWebhook } from "./deliver";
import { createSubscription, redeliver, rotateSecret, setEnabled } from "./service";
import { signatureHeader, verifySignature } from "./signature";

const SECRET = "whsec_test_secret";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let regular: PermSetUser;
const servers: Server[] = [];

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true, name: "Webhook Admin" });
  admin = {
    id: adminRow.id,
    type: "admin",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  const regularRow = await seedUser(h.db, { name: "Webhook Regular" });
  regular = {
    id: regularRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
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
  handler: (
    request: { headers: Record<string, string | string[] | undefined>; body: string },
    respond: (status: number, headers?: Record<string, string>) => void,
  ) => void,
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
      createdBy: admin.id,
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
  const [row] = await h.db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id));
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
    expect(sent[0]?.html).toContain('src="https://app.example.com/brand/email-logo@2x.png"');
    expect(sent[0]?.text.startsWith("Dealflow\n\n")).toBe(true);
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
    // https forces the scheme check to pass, and localhost is a name (not a literal IP), so the
    // refusal must come from the DNS lookup.
    const url = `https://localhost:${new URL(receiver.url).port}/hook`;
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

describe("webhook subscriptions", () => {
  const input = {
    name: "Public hook",
    url: "https://example.com/hooks/dealflow",
    events: ["deal.won", "invoice.paid"],
  };

  it("returns the secret once and stores it encrypted", async () => {
    const created = await createSubscription(h.db, admin, input, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.secret.startsWith("whsec_")).toBe(true);

    const [row] = await h.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, created.value.subscription.id));
    expect(row?.secretEnc.toString("utf8")).not.toBe(created.value.secret);
    expect(row?.secretEnc.toString("utf8")).not.toContain("whsec_");
    // No read view carries the sealed value.
    expect("secretEnc" in created.value.subscription).toBe(false);
  });

  it("rotates the secret so old signatures stop verifying", async () => {
    const created = await createSubscription(h.db, admin, input, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const oldSecret = created.value.secret;
    const rotated = await rotateSecret(h.db, admin, created.value.subscription.id, sig());
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.value).not.toBe(oldSecret);

    const body = '{"a":1}';
    const now = Math.floor(Date.now() / 1000);
    const oldHeader = signatureHeader(oldSecret, now, body);
    const newHeader = signatureHeader(rotated.value, now, body);
    expect(verifySignature(oldSecret, newHeader, body, now)).toBe(false);
    expect(verifySignature(rotated.value, oldHeader, body, now)).toBe(false);
    expect(verifySignature(rotated.value, newHeader, body, now)).toBe(true);
  });

  it("resets consecutive failures when re-enabled", async () => {
    const created = await createSubscription(h.db, admin, input, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.subscription.id;
    await h.db
      .update(webhookSubscriptions)
      .set({
        enabled: false,
        consecutiveFailures: 9,
        disabledReason: "Disabled after 10 failed deliveries",
      })
      .where(eq(webhookSubscriptions.id, id));

    const enabled = await setEnabled(h.db, admin, id, true, sig());
    expect(enabled.ok).toBe(true);
    if (!enabled.ok) return;
    expect(enabled.value.consecutiveFailures).toBe(0);
    expect(enabled.value.disabledReason).toBeNull();
  });

  it("creates a new delivery for a redelivery", async () => {
    const created = await createSubscription(h.db, admin, input, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const deliveryId = await seedDelivery(created.value.subscription.id);

    const result = await redeliver(h.db, admin, deliveryId, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.deliveryId).not.toBe(deliveryId);
    const [copy] = await h.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, result.value.deliveryId));
    expect(copy?.eventType).toBe("deal.won");
    expect(copy?.status).toBe("pending");
  });

  it("refuses a non-admin", async () => {
    const result = await createSubscription(h.db, regular, input, sig());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.PERM_DENIED);
  });

  it("refuses a private URL when private targets are off", async () => {
    const result = await createSubscription(
      h.db,
      admin,
      { ...input, url: "https://127.0.0.1/hook" },
      sig(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.WEBHOOK_URL_REFUSED);
  });
});
