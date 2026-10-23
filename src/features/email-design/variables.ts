// Variable rendering for email templates (PLAN-PART13 6.5). The template carries `{{name}}`
// tokens; values are escaped in HTML mode and inserted raw in text mode. Headers additionally go
// through stripHeaderBreaks so a value can never inject CR/LF into a subject or preheader.

export type VariableMode = "html" | "text";

const TOKEN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;
const SPACE = /\s+/g;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export function renderVariables(
  template: string,
  values: Readonly<Record<string, string>>,
  options: { mode: VariableMode },
): string {
  return template.replace(TOKEN, (_match, name: string) => {
    const value = values[name] ?? "";
    return options.mode === "html" ? escapeHtml(value) : value;
  });
}

// Subjects and preview lines are single-line headers. Strip every C0 control character (CR, LF,
// tab and friends), collapse the resulting whitespace and cut to the header's limit.
export function stripHeaderBreaks(value: string, max: number): string {
  return value.replace(CONTROL, " ").replace(SPACE, " ").trim().slice(0, max);
}
