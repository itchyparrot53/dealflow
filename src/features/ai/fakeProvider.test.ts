import { describe, expect, it } from "vitest";
import { fakeProvider } from "./fakeProvider";
import type { AiChatMessage, AiChatRequest } from "./types";

const provider = fakeProvider();
const signal = (): AbortSignal => new AbortController().signal;

const system = (content: string): AiChatMessage => ({ role: "system", content });
const user = (content: string): AiChatMessage => ({ role: "user", content });

async function chat(req: AiChatRequest) {
  const result = await provider.chat(req, signal());
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function parsed(content: string | null): Record<string, unknown> {
  if (content === null) throw new Error("expected content");
  return JSON.parse(content) as Record<string, unknown>;
}

describe("fakeProvider", () => {
  it("answers the deal summary prompt", async () => {
    const result = await chat({
      messages: [system("You are a sales analyst inside a CRM."), user("{}")],
    });
    expect(parsed(result.content).summary).toBe("FAKE summary of this deal.");
    expect(parsed(result.content).health).toBe("at_risk");
    expect(result.model).toBe("fake/dealflow");
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it("answers the deal score prompt", async () => {
    const result = await chat({
      messages: [system("You score sales deals from 0 to 100."), user("{}")],
    });
    expect(parsed(result.content).score).toBe(72);
  });

  it("echoes the instruction into the email draft", async () => {
    const result = await chat({
      messages: [
        system("You write sales emails for Alex."),
        user(JSON.stringify({ instruction: "ask for a call" })),
      ],
    });
    expect(parsed(result.content)).toEqual({
      subject: "FAKE subject",
      body: "FAKE body: ask for a call",
    });
  });

  it("turns notes into one dated activity", async () => {
    const result = await chat({
      messages: [
        system("You turn meeting or call notes into follow-up activities."),
        user("call notes"),
      ],
    });
    const activities = parsed(result.content).activities as { dueDate: string; typeKey: string }[];
    expect(activities[0]?.dueDate).toBe(new Date().toISOString().slice(0, 10));
    expect(activities[0]?.typeKey).toBe("task");
  });

  it("answers the filter builder prompt", async () => {
    const result = await chat({
      messages: [system("You are a CRM filter builder."), user("big deals")],
    });
    expect(parsed(result.content).explanation).toBe("FAKE: deals worth more than 1,000");
  });

  it("answers the assistant with the last user message", async () => {
    const result = await chat({ messages: [system("You are Dealflow Assistant."), user("hello")] });
    expect(result.content).toBe("FAKE AI: hello");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("emits one tool call for /fake-tool", async () => {
    const result = await chat({
      messages: [
        system("You are Dealflow Assistant."),
        user('/fake-tool {"name":"add_note","arguments":{"body":"x"}}'),
      ],
    });
    expect(result.content).toBeNull();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("add_note");
    expect(JSON.parse(result.toolCalls[0]?.arguments ?? "{}")).toEqual({ body: "x" });
  });

  it("answers with text once a tool result is the last message", async () => {
    const result = await chat({
      messages: [
        system("You are Dealflow Assistant."),
        user('/fake-tool {"name":"add_note","arguments":{"body":"x"}}'),
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "fake_1",
              type: "function",
              function: { name: "add_note", arguments: '{"body":"x"}' },
            },
          ],
        },
        { role: "tool", content: '{"status":"pending_confirmation"}', tool_call_id: "fake_1" },
      ],
    });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.content).toBe('FAKE AI: /fake-tool {"name":"add_note","arguments":{"body":"x"}}');
  });
});
