#!/usr/bin/env node
// Verifies PROGRESS.md against the plan and git history (fast verification profile).
// Usage: node scripts/check-progress.mjs          (during the run)
//        node scripts/check-progress.mjs --final  (before setting STATUS: COMPLETE)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART11.md";
const final = process.argv.includes("--final");
const plan = readFileSync(PLAN_FILE, "utf8");
const progress = readFileSync("PROGRESS.md", "utf8");
const problems = [];

const planId = (plan.match(/Plan ID:\s*([A-Za-z0-9._-]+)/) || [])[1];
if (planId && !progress.includes(planId)) problems.push(`PROGRESS.md does not carry plan id ${planId}`);
const tasks = [...plan.matchAll(/^#### Task (\d+\.\d+) [-\u2014] (.+)$/gm)].map((m) => ({ id: m[1], title: m[2].trim() }));
const ticked = new Set([...progress.matchAll(/^- \[x\] (\d+\.\d+)\b/gm)].map((m) => m[1]));
const base = (progress.match(/^- Phase 0: ([0-9a-f]{7,40})/m) || [])[1];
if (!base) problems.push('PROGRESS.md has no "- Phase 0: <hash>" base commit');
const range = base ? `${base}..HEAD` : "HEAD";
const subjects = execSync(`git --no-optional-locks log --format=%s ${range}`, { encoding: "utf8" }).split("\n").filter(Boolean);

for (const s of subjects) {
  if (/^\d+\.\d+\s*[-–,]\s*\d+\.\d+/.test(s)) problems.push(`combined commit not allowed: "${s}"`);
}
const qaLog = (progress.split(/^## QA log$/m)[1] || "").split(/^## /m)[0];
for (const t of tasks) {
  const committed = subjects.some((s) => s.startsWith(`${t.id}: `));
  if (ticked.has(t.id) && !committed) problems.push(`${t.id} is ticked but there is no commit "${t.id}: ..." since ${base}`);
  if (/QA gate$/.test(t.title) && ticked.has(t.id)) {
    const phase = t.id.split(".")[0];
    const line = qaLog.split("\n").find((l) => l.includes(`Phase ${phase} gate`));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "Phase ${phase} gate" line`);
    else if (!/commands (green|red)/i.test(line)) problems.push(`Phase ${phase} gate line must say "commands green" or "commands red"`);
  }
  if (/^Independent review/.test(t.title) && ticked.has(t.id)) {
    const line = qaLog.split("\n").find((l) => l.startsWith("- Independent review"));
    if (!line) problems.push(`${t.id} is ticked but the QA log has no "- Independent review" line`);
    else if (!/(qa\.sh|QA RESULT)/i.test(line)) problems.push("the Independent review line has no qa.sh result");
  }
}
if (final) {
  const last = tasks[tasks.length - 1];
  for (const t of tasks) if (t !== last && !ticked.has(t.id)) problems.push(`not done: ${t.id} ${t.title}`);
  if (/^##\s*Final report\s*\n+\(written/m.test(progress)) problems.push("Final report section is still empty");
}
if (problems.length) {
  console.log(problems.map((p) => `PROGRESS CHECK: ${p}`).join("\n"));
  process.exit(1);
}
console.log(`PROGRESS CHECK OK: ${ticked.size}/${tasks.length} tasks ticked, all with commits${final ? ", ready to complete" : ""}`);
