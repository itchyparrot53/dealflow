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

  it("parses a JSON object embedded in prose", async () => {
    const provider = new ScriptedAiProvider({
      content: 'Here is the result: {"answer":"wrapped"} thanks',
    });
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d.value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answer).toBe("wrapped");
  });

  it("doubles the token budget once when a reasoning reply is cut off", async () => {
    const provider = new ScriptedAiProvider(
      { content: "", finishReason: "length" },
      { content: '{"answer":"after retry"}', finishReason: "stop" },
    );
    const d = deps(provider);
    const opts = { ...OPTS, maxTokens: 800 };
    const result = await chatJson(db, "user-1", "email_draft", opts, signal(), d.value);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answer).toBe("after retry");
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]?.maxTokens).toBe(800);
    expect(provider.calls[1]?.maxTokens).toBe(1600);
  });

  it("gives up with E_AI_012 after two truncated replies", async () => {
    const provider = new ScriptedAiProvider(
      { content: "", finishReason: "length" },
      { content: '{"answer":', finishReason: "length" },
    );
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d.value);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_EMPTY_OR_TRUNCATED);
    expect(provider.calls).toHaveLength(2);
  });

  it("retries once when the JSON does not match the schema", async () => {
    const provider = new ScriptedAiProvider(
      { content: '{"wrong":1}', finishReason: "stop" },
      { content: '{"answer":"right"}', finishReason: "stop" },
    );
    const d = deps(provider);
    const result = await chatJson(db, "user-1", "assistant", OPTS, signal(), d.value);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answer).toBe("right");
    expect(provider.calls).toHaveLength(2);
  });

  it("passes the feature to the provider for its metadata log", async () => {
    const provider = new ScriptedAiProvider({ content: '{"answer":"x"}', finishReason: "stop" });
    const d = deps(provider);
    await chatJson(db, "user-1", "ai_filter", OPTS, signal(), d.value);
    expect(provider.calls[0]?.feature).toBe("ai_filter");
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
