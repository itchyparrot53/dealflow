import { describe, expect, test } from "vitest";
import { buildPushPayload } from "./payload";

function payload(input: { title?: string; body?: string | null; href?: string; id?: string }) {
  return JSON.parse(
    buildPushPayload({
      title: input.title ?? "Ada mentioned you",
      body: input.body === undefined ? "On Acme renewal" : input.body,
      href: input.href ?? "/deals/deal-1",
      id: input.id ?? "notif-1",
    }),
  ) as { title: string; body: string; url: string; tag: string };
}

describe("buildPushPayload", () => {
  test("returns a JSON string with the notification fields", () => {
    const raw = buildPushPayload({
      title: "Ada mentioned you",
      body: "On Acme renewal",
      href: "/deals/deal-1",
      id: "notif-1",
    });
    expect(typeof raw).toBe("string");
    expect(JSON.parse(raw)).toEqual({
      title: "Ada mentioned you",
      body: "On Acme renewal",
      url: "/deals/deal-1",
      tag: "notif-1",
    });
  });

  test("keeps a body of exactly 140 characters", () => {
    const body = "a".repeat(140);
    expect(payload({ body }).body).toBe(body);
  });

  test("truncates a longer body to 140 characters with an ellipsis", () => {
    const body = "a".repeat(200);
    const short = payload({ body }).body;
    expect(short).toHaveLength(140);
    expect(short.endsWith("…")).toBe(true);
    expect(short.slice(0, -1)).toBe("a".repeat(139));
  });

  test("uses an empty string for a missing body", () => {
    expect(payload({ body: null }).body).toBe("");
  });

  test("keeps the path and query of a same-origin link", () => {
    expect(payload({ href: "/activities/list?from=none" }).url).toBe("/activities/list?from=none");
  });

  test("rewrites absolute and foreign links to the notifications page", () => {
    for (const href of [
      "https://evil.example/deals",
      "http://evil.example/deals",
      "//evil.example/deals",
      "javascript:alert(1)",
      "deals/deal-1",
      "",
    ]) {
      expect(payload({ href }).url, href).toBe("/notifications");
    }
  });

  test("keeps the title and uses the notification id as the tag", () => {
    const out = payload({ title: "Deal won: Acme", id: "notif-9" });
    expect(out.title).toBe("Deal won: Acme");
    expect(out.tag).toBe("notif-9");
  });
});
