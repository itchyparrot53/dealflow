// Two-key shortcut sequences ("g" then "d"). The caller decides whether focus is in a text field;
// this matcher only tracks a pending prefix and its deadline, so it stays a pure unit.

export interface SequenceMatcher {
  press: (key: string, now: number) => string | null;
  reset: () => void;
}

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "OS"]);

export function createSequenceMatcher(
  map: Record<string, string>,
  timeoutMs: number,
): SequenceMatcher {
  const commands = new Map(Object.entries(map));
  const prefixes = new Set(Object.keys(map).map((sequence) => sequence.split(" ")[0] ?? ""));
  let pending: { key: string; at: number } | null = null;

  return {
    press(key, now) {
      if (MODIFIERS.has(key) || key === "Escape") {
        pending = null;
        return null;
      }
      if (pending !== null && now - pending.at <= timeoutMs) {
        const command = commands.get(`${pending.key} ${key}`);
        if (command !== undefined) {
          pending = null;
          return command;
        }
      }
      pending = prefixes.has(key) ? { key, at: now } : null;
      return null;
    },
    reset() {
      pending = null;
    },
  };
}
