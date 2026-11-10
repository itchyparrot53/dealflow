// The builder iframe is sandboxed without allow-same-origin, so its messages arrive with the opaque
// origin string "null". Anything else is a foreign frame and is ignored (6.6).

export interface BlockClickMessage {
  type: "df-block-click";
  id: string;
}

export function blockIdFromMessage(origin: string, data: unknown): string | null {
  if (origin !== "null") return null;
  if (typeof data !== "object" || data === null) return null;
  const message = data as { type?: unknown; id?: unknown };
  if (message.type !== "df-block-click") return null;
  if (typeof message.id !== "string" || message.id === "") return null;
  return message.id;
}
