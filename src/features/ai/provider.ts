import { env } from "@/config/env";
import { fakeProvider } from "./fakeProvider";
import { createOpenRouterProvider } from "./openrouterProvider";
import type { AiProvider } from "./types";

// Provider selection: a test override wins, then the deterministic fake, then OpenRouter when a key
// is configured, otherwise null (the AI features are simply unavailable).
const OVERRIDE_KEY = Symbol.for("dealflow.aiProvider");

interface Holder {
  value: AiProvider | null;
}

function store(): Record<symbol, Holder | undefined> {
  return globalThis;
}

let cached: AiProvider | null = null;
let warnedFake = false;

export function setAiProviderForTest(provider: AiProvider | null | undefined): void {
  if (provider === undefined) delete store()[OVERRIDE_KEY];
  else store()[OVERRIDE_KEY] = { value: provider };
}

export function getAiProvider(): AiProvider | null {
  const override = store()[OVERRIDE_KEY];
  if (override !== undefined) return override.value;
  if (env.AI_FAKE) {
    if (!warnedFake) {
      console.warn("AI_FAKE is on: AI answers are fake");
      warnedFake = true;
    }
    cached ??= fakeProvider();
    return cached;
  }
  if (env.OPENROUTER_API_KEY === "") return null;
  cached ??= createOpenRouterProvider();
  return cached;
}
