import type { AiChatRequest, AiChatResult, AiProvider } from "./types";

// Deterministic provider for tests, the e2e stack and AI_FAKE demos. No network, no key, identical
// answers for identical requests.

function joinSystem(req: AiChatRequest): string {
  return req.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
}

function lastUserContent(req: AiChatRequest): string {
  for (let index = req.messages.length - 1; index >= 0; index--) {
    const message = req.messages[index];
    if (message?.role === "user") return message.content;
  }
  return "";
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const SUMMARY = JSON.stringify({
  summary: "FAKE summary of this deal.",
  health: "at_risk",
  risks: ["FAKE risk: no recent contact"],
  nextSteps: [{ subject: "FAKE follow-up call", typeKey: "call", dueInDays: 2 }],
});

const SCORE = JSON.stringify({
  score: 72,
  reasons: ["FAKE: engaged contact", "FAKE: close date soon"],
});

const FILTER = JSON.stringify({
  definition: {
    combinator: "and",
    conditions: [{ field: "value", op: "gt", value: 1000 }],
  },
  explanation: "FAKE: deals worth more than 1,000",
});

function emailDraft(req: AiChatRequest): string {
  const instruction = parseJson(lastUserContent(req))?.instruction;
  const text = typeof instruction === "string" ? instruction : "";
  return JSON.stringify({ subject: "FAKE subject", body: `FAKE body: ${text}` });
}

function notesToActivities(): string {
  return JSON.stringify({
    activities: [
      { subject: "FAKE follow-up task", typeKey: "task", dueDate: todayUtc(), note: "FAKE" },
    ],
  });
}

function fakeToolCalls(req: AiChatRequest): AiChatResult["toolCalls"] {
  const last = req.messages[req.messages.length - 1];
  if (last === undefined || last.role !== "user" || !last.content.startsWith("/fake-tool ")) {
    return [];
  }
  const command = parseJson(last.content.slice("/fake-tool ".length));
  const name = typeof command?.name === "string" ? command.name : "";
  return [
    {
      id: "fake_1",
      name,
      arguments: JSON.stringify(command?.arguments ?? {}),
    },
  ];
}

export function fakeProvider(): AiProvider {
  return {
    kind: "fake",
    chat(req) {
      const system = joinSystem(req);
      let content: string | null;
      let toolCalls: AiChatResult["toolCalls"] = [];

      if (system.includes("sales analyst")) {
        content = SUMMARY;
      } else if (system.includes("score sales deals")) {
        content = SCORE;
      } else if (system.includes("You write sales emails")) {
        content = emailDraft(req);
      } else if (system.includes("turn meeting or call notes")) {
        content = notesToActivities();
      } else if (system.includes("CRM filter builder")) {
        content = FILTER;
      } else if (system.includes("Dealflow Assistant")) {
        // The /fake-tool branch only fires while the user message is the last one; once the tool
        // result comes back this falls through to a text answer and the loop ends.
        const calls = fakeToolCalls(req);
        if (calls.length > 0) {
          content = null;
          toolCalls = calls;
        } else {
          content = `FAKE AI: ${lastUserContent(req)}`;
        }
      } else {
        content = `FAKE AI: ${lastUserContent(req)}`;
      }

      return Promise.resolve({
        ok: true as const,
        value: {
          content,
          toolCalls,
          usage: { promptTokens: 10, completionTokens: 5 },
          model: "fake/dealflow",
        },
      });
    },
  };
}
