import { describe, expect, it, vi } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import type { Db } from "@/db/client";
import type { HydratedActor } from "@/server/hydrateActor";
import { ok } from "@/types/result";
import { describeFilter, type FilterReference, fieldCatalogue } from "./aiFilter";
import type { ChatJsonDeps } from "./chatJson";
import { ScriptedAiProvider } from "./scriptedProvider";

const db = {} as Db;
const signal = (): AbortSignal => AbortSignal.timeout(2_000);

const actor: HydratedActor = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: null,
  type: "admin",
  isActive: true,
  groupIds: new Set<string>(),
  flags: new Set<PermissionFlagKey>(),
};

const REFERENCE: FilterReference = {
  fields: fieldCatalogue("deal"),
  users: [{ id: "user-1", name: "Ada" }],
  stages: [{ id: "stage-1", name: "Qualified" }],
  labels: ["Hot"],
  today: "2026-10-19",
};

const VALID = JSON.stringify({
  definition: {
    combinator: "and",
    conditions: [{ field: "value", op: "gt", value: 10000 }],
  },
  explanation: "Big deals",
});

function deps(provider: ScriptedAiProvider): { chat: ChatJsonDeps } {
  return {
    chat: {
      assertAllowed: () => Promise.resolve(ok(provider)),
      record: vi.fn(() => Promise.resolve()),
    },
  };
}

describe("describeFilter", () => {
  it("accepts a valid deal definition", async () => {
    const provider = new ScriptedAiProvider({ content: VALID });
    const result = await describeFilter(
      db,
      actor,
      { entity: "deal", text: "big deals" },
      signal(),
      {
        reference: REFERENCE,
        ...deps(provider),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.explanation).toBe("Big deals");
    const definition = result.value.definition as { conditions: unknown[] };
    expect(definition.conditions).toHaveLength(1);
  });

  it("rejects an unknown field and retries with the repair message", async () => {
    const provider = new ScriptedAiProvider(
      {
        content: JSON.stringify({
          definition: { combinator: "and", conditions: [{ field: "nope", op: "eq", value: 1 }] },
          explanation: "bad",
        }),
      },
      { content: VALID },
    );
    const result = await describeFilter(
      db,
      actor,
      { entity: "deal", text: "big deals" },
      signal(),
      {
        reference: REFERENCE,
        ...deps(provider),
      },
    );
    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(2);
    const retry = provider.calls[1]?.messages ?? [];
    expect(
      retry.some(
        (message) =>
          message.role === "user" &&
          message.content.startsWith("Your previous reply was not valid"),
      ),
    ).toBe(true);
  });

  it("fails with E_AI_005 after two invalid definitions", async () => {
    const invalid = JSON.stringify({
      definition: { combinator: "and", conditions: [{ field: "nope", op: "eq", value: 1 }] },
      explanation: "bad",
    });
    const provider = new ScriptedAiProvider({ content: invalid }, { content: invalid });
    const result = await describeFilter(
      db,
      actor,
      { entity: "deal", text: "big deals" },
      signal(),
      {
        reference: REFERENCE,
        ...deps(provider),
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_BAD_OUTPUT);
  });

  it("lists the deal fields and their operators in the system prompt", async () => {
    const provider = new ScriptedAiProvider({ content: VALID });
    await describeFilter(db, actor, { entity: "deal", text: "big deals" }, signal(), {
      reference: REFERENCE,
      ...deps(provider),
    });
    const system = provider.calls[0]?.messages[0]?.content ?? "";
    expect(system).toContain("value");
    expect(system).toContain("expectedCloseDate");
    expect(system).toContain("today");
  });
});
