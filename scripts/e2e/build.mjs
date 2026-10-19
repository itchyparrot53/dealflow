import { spawnSync } from "node:child_process";
import { e2eEnv, randomSecrets } from "./e2e-env.mjs";

// Builds the production bundle with the e2e env so NEXT_PUBLIC_* values (the WebSocket URL) are
// inlined for the e2e origin instead of whatever .env happens to hold.
const result = spawnSync("pnpm", ["exec", "next", "build"], {
  env: { ...process.env, ...e2eEnv(randomSecrets()) },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
