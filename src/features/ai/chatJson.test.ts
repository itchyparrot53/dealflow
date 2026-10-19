import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok } from "@/types/result";
import { type ChatJsonDeps, chatJson, stripJsonFences } from "./chatJson";
import { ScriptedAiProvider } from "./scriptedProvider";

const db = {} as Db;
const signal = (): AbortSignal => AbortSignal.timeout(2_000);
const schema = z.object({ answer: z.string() });
const OPTS = { system: "system prompt", user: "user prompt", schema };

function deps(provider: ScriptedAiProvider) {
  const record = vi.fn(() => Promise.resolve());
  const value: ChatJsonDeps = {
    assertAllowed: () => Promise.resolve(ok(provider)),
    record,
  };
  return { value, record };
}

describe("stripJsonFences", () => {
  it("unwraps a fenced json block and leaves plain JSON alone", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("chatJson", () => {
  it("parses a fenced JSON reply and records usage once", async () => {
    const provider = new ScriptedAiProvider({ content: '```json\n{"answer":"yes"}\n```' });
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "deal_summary", OPTS, signal(), d.value);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answer).toBe("yes");
    expect(d.record).toHaveBeenCalledTimes(1);
    expect(d.record).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ userId: "user-1", feature: "deal_summary" }),
      expect.anything(),
    );
  });

  it("retries once after invalid JSON and succeeds with the repair message", async () => {
    const provider = new ScriptedAiProvider(
      { content: "not json" },
      { content: '{"answer":"fixed"}' },
    );
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "deal_score", OPTS, signal(), d.value);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answer).toBe("fixed");
    expect(provider.calls).toHaveLength(2);
    const retryMessages = provider.calls[1]?.messages ?? [];
    expect(
      retryMessages.some(
        (message) =>
          message.role === "user" &&
          message.content.startsWith("Your previous reply was not valid"),
      ),
    ).toBe(true);
    expect(d.record).toHaveBeenCalledTimes(2);
  });

  it("gives up with E_AI_005 after two invalid replies", async () => {
    const provider = new ScriptedAiProvider({ content: "nope" }, { content: "still nope" });
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d.value);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_BAD_OUTPUT);
    expect(d.record).toHaveBeenCalledTimes(2);
  });

  it("returns a provider error without retrying", async () => {
    const provider = new ScriptedAiProvider(
      new AppError(ERROR_IDS.AI_PROVIDER_FAILED, "provider down"),
    );
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d.value);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_PROVIDER_FAILED);
    expect(provider.calls).toHaveLength(1);
    expect(d.record).not.toHaveBeenCalled();
  });

  it("returns an assertAllowed failure before touching the provider", async () => {
    const provider = new ScriptedAiProvider({ content: '{"answer":"x"}' });
    const d: ChatJsonDeps = {
      assertAllowed: () => Promise.resolve(err(new AppError(ERROR_IDS.AI_UNAVAILABLE, "no key"))),
      record: vi.fn(() => Promise.resolve()),
    };
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_UNAVAILABLE);
    expect(provider.calls).toHaveLength(0);
  });
});
