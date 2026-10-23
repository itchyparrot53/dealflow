import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";
import { notificationCta, renderNotificationEmail } from "./render";

function render(over: {
  type?: (typeof NOTIFICATION_TYPES)[number];
  entityType: string | null;
  entityId: string | null;
}): ReturnType<typeof renderNotificationEmail> {
  return renderNotificationEmail(
    {
      id: "n1",
      userId: "u1",
      type: over.type ?? "activity_reminder",
      entityType: over.entityType,
      entityId: over.entityId,
      actorId: null,
      payload: { subject: "Meeting" },
      readAt: null,
      createdAt: new Date().toISOString(),
    },
    "Jane",
  );
}

describe("renderNotificationEmail link", () => {
  it("links to the real route for each entity type", () => {
    expect(render({ entityType: "deal", entityId: "d1" }).url).toContain("/deals/d1");
    // The old renderer pluralized the entity type: /persons/<id> and /organizations/<id>, neither
    // of which is a route in this app.
    expect(render({ entityType: "person", entityId: "p1" }).url).toContain("/contacts/people/p1");
    expect(render({ entityType: "organization", entityId: "o1" }).url).toContain(
      "/contacts/orgs/o1",
    );
    expect(render({ entityType: "lead", entityId: "l1" }).url).toContain("/leads/l1");
  });

  it("falls back to the app root for a ref with no detail route", () => {
    // "activity" used to render /activitys/<id>.
    const out = render({ entityType: "activity", entityId: "a1" });
    expect(out.url).not.toContain("/activitys/");
    expect(out.url).toBe(env.BASE_URL);
  });

  it("falls back to the app root when the row has no target", () => {
    expect(render({ entityType: null, entityId: null }).url).toBe(env.BASE_URL);
  });
});

describe("renderNotificationEmail", () => {
  it("renders a mention with its subject, line and conversation CTA", () => {
    const out = renderNotificationEmail(
      {
        id: "n1",
        userId: "u1",
        type: "mention",
        entityType: "deal",
        entityId: "d1",
        actorId: "u2",
        payload: { source: "note", sourceId: "s1" },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      "Jane",
    );
    expect(out.subject).toContain("mentioned you");
    expect(out.line).toContain("Jane");
    expect(out.cta).toBe("Open conversation");
  });

  it("renders an activity reminder email", () => {
    const out = renderNotificationEmail(
      {
        id: "n2",
        userId: "u1",
        type: "activity_reminder",
        entityType: "deal",
        entityId: "d1",
        actorId: null,
        payload: { subject: "Call Acme" },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      "Jane",
    );
    expect(out.subject).toContain("Reminder");
    expect(out.line).toContain("Call Acme");
    expect(out.cta).toBe("Open activity");
  });

  it("gives every notification type a non-empty subject, line, CTA and URL", () => {
    for (const type of NOTIFICATION_TYPES) {
      const out = renderNotificationEmail(
        {
          id: "n3",
          userId: "u1",
          type,
          entityType: null,
          entityId: null,
          actorId: null,
          payload: { subject: "Task" },
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        "Bob",
      );
      expect(out.subject.length, `subject empty for type ${type}`).toBeGreaterThan(0);
      expect(out.line.length, `line empty for type ${type}`).toBeGreaterThan(0);
      expect(out.cta.length, `cta empty for type ${type}`).toBeGreaterThan(0);
      expect(out.url.startsWith(env.BASE_URL), `url wrong for type ${type}`).toBe(true);
    }
  });

  it("maps the CTA labels from 6.4", () => {
    expect(notificationCta("deal_won")).toBe("Open deal");
    expect(notificationCta("booking_created")).toBe("Open booking");
    expect(notificationCta("form_submission")).toBe("Open form");
    expect(notificationCta("document_viewed")).toBe("Open quote");
  });
});
