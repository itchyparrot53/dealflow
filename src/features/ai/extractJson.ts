import { err, ok, type Result } from "@/types/result";

// Models wrap otherwise valid JSON in prose or a markdown fence, and some reasoning models leak a
// truncated object. This extracts the first parseable value without ever evaluating the text
// (PLAN-PART12.md 6.9).
export function extractJson(text: string): Result<unknown, Error> {
  const trimmed = text.trim();
  if (trimmed === "") return err(new Error("empty response"));

  const direct = tryParse(trimmed);
  if (direct.ok) return direct;

  // A fenced block anywhere in the text, not only when it spans the whole reply.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1] !== undefined) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed.ok) return parsed;
  }

  // The first object, to its matching brace. Braces inside strings do not count.
  const start = trimmed.indexOf("{");
  if (start !== -1) {
    const end = matchingBrace(trimmed, start);
    if (end !== -1) {
      const parsed = tryParse(trimmed.slice(start, end + 1));
      if (parsed.ok) return parsed;
    }
  }

  return err(new Error("no JSON value found"));
}

function tryParse(text: string): Result<unknown, Error> {
  try {
    return ok(JSON.parse(text));
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
