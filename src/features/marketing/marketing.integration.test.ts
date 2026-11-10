import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  consentEvents,
  domainEvents,
  marketingSuppressions,
  personMarketing,
  persons,
} from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { ContactActor } from "@/features/contacts/personsRepo";
import { createPerson, updatePerson } from "@/features/contacts/personsRepo";
import type { PersonCreateInput } from "@/features/contacts/schemas";
import { transitionMarketingStatus } from "./service";
import { addSuppression, hashEmail } from "./suppression";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function actorOf(user: { id: string }): ContactActor {
  return {
    id: user.id,
    type: "admin",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
    primaryVisibilityGroupId: null,
  };
}

async function person(db: Db, ownerId: string, email: string | null) {
  const [row] = await db
    .insert(persons)
    .values({ name: "Test Person", primaryEmail: email, ownerId, visibilityLevel: "all" })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

function personInput(email: string): PersonCreateInput {
  return {
    name: "Imported Person",
    emails: [{ label: "work", value: email, primary: true }],
    phones: [],
    orgId: null,
    customFields: {},
  };
}

describe("marketing status service", () => {
  it("writes the status, the consent evidence and the domain event together", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const row = await person(db, user.id, "ada@example.com");

      const result = await transitionMarketingStatus(
        db,
        {
          personId: row.id,
          to: "subscribed",
          source: "manual",
          basis: "explicit",
          actorUserId: user.id,
        },
        signal,
      );

      expect(result.ok).toBe(true);
      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(marketing?.status).toBe("subscribed");
      expect(marketing?.consentBasis).toBe("explicit");

      const evidence = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.personId, row.id));
      expect(evidence).toHaveLength(1);
      expect(evidence[0]?.fromStatus).toBe("not_subscribed");
      expect(evidence[0]?.toStatus).toBe("subscribed");
      expect(evidence[0]?.source).toBe("manual");
      expect(evidence[0]?.emailHash).toBe(hashEmail("ada@example.com"));

      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.type, "person.marketing_status_changed"),
            eq(domainEvents.entityId, row.id),
          ),
        );
      expect(events).toHaveLength(1);
    });
  });

  it("refuses a transition outside the 6.2 table and writes nothing", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const row = await person(db, user.id, "grace@example.com");

      const result = await transitionMarketingStatus(
        db,
        { personId: row.id, to: "bounced", source: "manual" },
        signal,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_MARKETING_001");
      const marketing = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(marketing).toHaveLength(0);
      const evidence = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.personId, row.id));
      expect(evidence).toHaveLength(0);
    });
  });

  it("keeps the suppression after the person is deleted", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const row = await person(db, user.id, "linus@example.com");
      const subscribed = await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      expect(subscribed.ok).toBe(true);
      const unsubscribed = await transitionMarketingStatus(
        db,
        { personId: row.id, to: "unsubscribed", source: "one_click" },
        signal,
      );
      expect(unsubscribed.ok).toBe(true);

      const hash = hashEmail("linus@example.com");
      const [suppression] = await db
        .select()
        .from(marketingSuppressions)
        .where(eq(marketingSuppressions.emailHash, hash));
      expect(suppression?.reason).toBe("unsubscribed");

      await db.delete(persons).where(eq(persons.id, row.id));

      const after = await db
        .select()
        .from(marketingSuppressions)
        .where(eq(marketingSuppressions.emailHash, hash));
      expect(after).toHaveLength(1);
      const evidence = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.emailHash, hash));
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence.every((row) => row.personId === null)).toBe(true);
    });
  });

  it("starts a new person with a suppressed email as unsubscribed", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      await addSuppression(db, hashEmail("old@example.com"), "hard_bounce", signal);

      const created = await createPerson(db, actorOf(user), personInput("old@example.com"), signal);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, created.value.id));
      expect(marketing?.status).toBe("bounced");
      const evidence = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.personId, created.value.id));
      expect(evidence[0]?.source).toBe("system");
      expect(evidence[0]?.fromStatus).toBe("not_subscribed");
    });
  });

  it("re-checks the suppression when the primary email changes", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const row = await person(db, user.id, "first@example.com");
      const subscribed = await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      expect(subscribed.ok).toBe(true);
      await addSuppression(db, hashEmail("second@example.com"), "unsubscribed", signal);

      const updated = await updatePerson(
        db,
        actorOf(user),
        {
          id: row.id,
          emails: [{ label: "work", value: "second@example.com", primary: true }],
        },
        signal,
      );
      expect(updated.ok).toBe(true);
      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, row.id));
      expect(marketing?.status).toBe("unsubscribed");
    });
  });

  it("treats a repeat of the current status as a no-op", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const row = await person(db, user.id, "noop@example.com");
      await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      const again = await transitionMarketingStatus(
        db,
        { personId: row.id, to: "subscribed", source: "manual", basis: "explicit" },
        signal,
      );
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.value.changed).toBe(false);
      const evidence = await db
        .select()
        .from(consentEvents)
        .where(eq(consentEvents.personId, row.id));
      expect(evidence).toHaveLength(1);
    });
  });
});
