import { describe, expect, it } from "vitest";
import { extractJson } from "./extractJson";

function value(text: string): unknown {
  const result = extractJson(text);
  if (!result.ok) throw new Error(`expected JSON, got ${result.error.message}`);
  return result.value;
}

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(value('{"subject":"Hi","body":"Hello"}')).toEqual({ subject: "Hi", body: "Hello" });
  });

  it("parses a fenced block with prose before and after", () => {
    const text = 'Sure, here it is:\n```json\n{"a":1}\n```\nLet me know if you need changes.';
    expect(value(text)).toEqual({ a: 1 });
  });

  it("parses an embedded object in prose", () => {
    expect(value('The result is {"a":1,"b":[2,3]} as requested.')).toEqual({ a: 1, b: [2, 3] });
  });

  it("does not count braces inside strings", () => {
    const text = 'Here: {"template":"Hi {name}, you owe }","n":1} done';
    expect(value(text)).toEqual({ template: "Hi {name}, you owe }", n: 1 });
  });

  it("handles escaped quotes inside strings", () => {
    expect(value('noise {"text":"she said \\"hi\\"","ok":true} noise')).toEqual({
      text: 'she said "hi"',
      ok: true,
    });
  });

  it("fails for truncated JSON", () => {
    const result = extractJson('{"subject":"Hi","body":"unterminated');
    expect(result.ok).toBe(false);
  });

  it("fails for an empty reply", () => {
    expect(extractJson("   ").ok).toBe(false);
  });
});
