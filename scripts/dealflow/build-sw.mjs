import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";

// The service worker must be one classic script served from /sw.js, so it is bundled separately
// from the Next build. The build id is inlined so a new deploy activates a new cache and can ask
// open tabs to reload. Outside git (a tarball, a shallow image) a timestamp stands in.
function buildId() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const id = buildId();
mkdirSync("public", { recursive: true });
await build({
  entryPoints: ["src/features/pwa/sw/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  target: ["es2020"],
  define: { __SW_BUILD_ID__: JSON.stringify(id) },
  logLevel: "warning",
});
console.log(`build-sw: public/sw.js (build id ${id})`);
