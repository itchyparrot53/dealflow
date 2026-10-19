import OpenAI from "openai";

// Checks the configured OpenRouter model against the public model list, and optionally makes one
// tiny chat request when a key is present. Never calls --chat unless asked.

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: rely on the process environment.
}

const FALLBACK_BASE = "https://openrouter.ai/api/v1";
const FALLBACK_MODEL = "deepseek/deepseek-v4.1-flash";
const PREFIX = "deepseek/deepseek-v4.1-flash";

interface OpenRouterModel {
  id: string;
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchModels(base: string): Promise<OpenRouterModel[]> {
  const response = await fetch(`${base}/models`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body: unknown = await response.json();
  const data =
    typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
  return Array.isArray(data) ? (data as OpenRouterModel[]) : [];
}

async function chatOnce(base: string, model: string): Promise<void> {
  const key = (process.env.OPENROUTER_API_KEY ?? "").trim();
  if (key === "") {
    console.warn("skipped: OPENROUTER_API_KEY not set");
    return;
  }
  const client = new OpenAI({
    apiKey: key,
    baseURL: base,
    defaultHeaders: { "HTTP-Referer": process.env.BASE_URL ?? "", "X-Title": "Dealflow" },
  });
  const completion = await client.chat.completions.create(
    {
      model,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 20,
    },
    { signal: AbortSignal.timeout(30_000) },
  );
  console.warn(`reply: ${completion.choices[0]?.message.content ?? ""}`);
  console.warn(
    `usage: prompt=${completion.usage?.prompt_tokens ?? 0} completion=${completion.usage?.completion_tokens ?? 0}`,
  );
}

async function main(): Promise<void> {
  const base = (process.env.OPENROUTER_BASE_URL ?? "").trim() || FALLBACK_BASE;
  const configured = (process.env.OPENROUTER_MODEL ?? "").trim() || FALLBACK_MODEL;

  let models: OpenRouterModel[];
  try {
    models = await fetchModels(base);
  } catch (error) {
    console.warn(`MODEL LIST UNAVAILABLE: ${messageOf(error)}`);
    console.warn("model check not completed; the configured default is unchanged");
    process.exitCode = 1;
    return;
  }

  for (const model of models.filter((entry) => entry.id.startsWith(PREFIX))) {
    const tools = model.supported_parameters?.includes("tools") === true;
    const jsonMode = model.supported_parameters?.includes("response_format") === true;
    console.warn(
      `${model.id} | tools=${tools ? "yes" : "no"} | response_format=${jsonMode ? "yes" : "no"} | prompt=${model.pricing?.prompt ?? "?"} completion=${model.pricing?.completion ?? "?"} (per token)`,
    );
  }

  console.warn(
    models.some((entry) => entry.id === configured)
      ? "CONFIGURED MODEL LISTED"
      : "CONFIGURED MODEL NOT LISTED",
  );

  if (process.argv.includes("--chat")) await chatOnce(base, configured);
}

main().catch((error: unknown) => {
  console.error(`model check failed: ${messageOf(error)}`);
  process.exit(1);
});
