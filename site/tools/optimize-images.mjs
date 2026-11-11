#!/usr/bin/env node
/* eslint-disable */
// Generate the landing site's product screenshots from the real repository images.
// The supplied hero is copied as-is (the brief forbids re-encoding it), so this
// script only verifies it and records its size alongside the generated shots.

import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const outDir = resolve(repo, "site/assets/shots");
const heroPath = resolve(repo, "site/assets/hero.webp");

const SHOTS = [
  ["docs/screenshots/pipeline.png", "pipeline.webp"],
  ["docs/screenshots/deal-workspace.png", "deal.webp"],
  ["docs/screenshots/inbox.png", "inbox.webp"],
  ["docs/screenshots/campaigns.png", "campaigns.webp"],
  ["docs/user-guide/images/compose.png", "compose.webp"],
  ["docs/user-guide/images/insights-dashboard.png", "insights.webp"],
  ["docs/user-guide/images/calendar.png", "calendar.webp"],
  ["docs/user-guide/images/projects.png", "projects.webp"],
  ["docs/user-guide/images/mobile-board.png", "mobile.webp"],
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

await mkdir(outDir, { recursive: true });

const heroMeta = await sharp(heroPath).metadata();
const heroSize = (await stat(heroPath)).size;
if (heroMeta.width !== 1600 || heroMeta.height !== 640) {
  throw new Error(
    `site/assets/hero.webp is ${heroMeta.width}x${heroMeta.height}; expected the supplied 1600x640 hero`,
  );
}

console.log(
  `hero.webp (supplied, not re-encoded): ${heroMeta.width}x${heroMeta.height} ${kb(heroSize)}`,
);
console.log("");
console.log("| Source | Output | Size | Dimensions |");
console.log("| --- | --- | --- | --- |");

for (const [source, name] of SHOTS) {
  const input = resolve(repo, source);
  const output = resolve(outDir, name);
  const meta = await sharp(input).metadata();
  await sharp(input).webp({ quality: 80, effort: 5 }).toFile(output);
  const outMeta = await sharp(output).metadata();
  const size = (await stat(output)).size;
  if (outMeta.width > meta.width || outMeta.height > meta.height) {
    throw new Error(
      `${name} was upscaled: ${meta.width}x${meta.height} -> ${outMeta.width}x${outMeta.height}`,
    );
  }
  console.log(`| ${source} | ${name} | ${kb(size)} | ${outMeta.width}x${outMeta.height} |`);
}
