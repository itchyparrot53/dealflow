#!/usr/bin/env node
// Converts hex colours to the HSL channel triplet the shadcn tokens in globals.css use.
// Usage: node scripts/dealflow/hex-to-hsl.mjs '#2D8548' '#1168C9'
function channels(hex) {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}
for (const arg of process.argv.slice(2)) console.log(`${arg} -> ${channels(arg)}`);
