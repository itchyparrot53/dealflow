# PLAN: Dealflow on warpdrive, Part 11: Pipedrive parity design pass

> Plan ID: dealflow-wd-p11-v1 · Written: 2026-10-22 (rewritten for Pipedrive parity at the owner's request) · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 10 are finished (`PROGRESS-P1.md` to `PROGRESS-P9.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P10.md`). Part 10 left 5,351 unit tests, 2,097 integration tests and e2e specs `00` to `14`, all passing; every feature now exists. Part 11 is the last part: it restyles every screen to match Pipedrive's current web app one to one, using values the planner measured from the live app, proven by a mechanical style checker, computed-value parity checks, axe and a screenshot gallery. It changes no behaviour. Where it says "find", locate the existing component, restyle it, and log the file as a Decision only when it is surprising.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 10 (`PLAN-PART1.md` to `PLAN-PART10.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART11.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p11-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 10's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.5, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.2.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.5, 1.5, 2.6, 3.5):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.3.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (primitive classes, rail labels moved into tooltips, the page title moved into the top bar, style-guard allow-lists), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport; never download Pipedrive assets.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove or recreate the owner's running Compose project `warpdrive-main`, never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack 3001/5433/8080/9000/9001 (owner's). Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `PLAN-PART10.md`, `PLAN-PART11.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 10's file to `PROGRESS-P10.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p11-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 11: progress files, kit, baseline and design worklist
(every task through 4.5, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 4990/4990 · parity board 12/12

## Decisions
- 0.3: chose … over … because …

## Owner actions
- TODO(owner): …

## Open issues
- None

## Environment
(copy the section 4 "Known environment" commands that this machine needs, and keep them current)

## Final report
(written in Task 4.5)
```

## 1. Goal

Make Dealflow look like Pipedrive's current web app, one to one: the same colours, type sizes and weights, spacing, control sizes, corner radii, layout structure and component shapes, on every screen, without changing behaviour. The planner measured Pipedrive from full-resolution captures of the live app (August 2025, 1280×720 viewport) and wrote every value in section 6 as a number. A mechanical `check-design` script proves each file was restyled. A design e2e spec checks those numbers through computed styles, plus accessibility (axe) and horizontal scroll, and writes a screenshot gallery for the owner to review once.

Parity covers the look only. Dealflow keeps its own name, logo mark and icon set (lucide). Never copy Pipedrive's logo, wordmark, icon SVGs, illustrations or font files.

## 2. Definition of done

1. The tokens in 6.4 are implemented as CSS variables in `globals.css`.
   - Light is the parity theme.
   - Dark is the derived palette in 6.4.
   - Inter stays the typeface.
   - `@axe-core/playwright@4.14.0` (dev) is the only new dependency.
2. `scripts/dealflow/check-design.mjs` exists exactly as 6.3. It reports 0 violations over `src`, with at most 40 opt-outs, each carrying a reason.
3. Every primitive in `src/components/ui/` matches 6.6. The page title lives in the top bar (6.5) on every app page, and every app page uses `PageToolbar` (6.5).
4. The shell matches 6.7:
   - a 56 px icon-only indigo rail with a violet active tile and tooltips;
   - a 56 px white top bar with the page title, search pill, round add button, AI pill, icons and an initials avatar.
5. Every screen in 6.8 matches its spec. The differences table in 6.1 is fully closed.
6. Empty, loading and error states follow 6.8.13.
7. Public pages (`/d`, `/f`, `/book`, `/offline`, sign-in) use the tokens and always render light.
8. `e2e/15-design.spec.ts` passes. It checks:
   - the 6.10 computed values in light;
   - a visible focus ring on Tab;
   - no horizontal scroll at 375 px;
   - zero serious or critical axe violations on every gallery screen;
   - the gallery in `e2e/screenshots/design/`: 26 screens light at 1440 and 375, plus the 21 app screens dark at 1440, 73 files.
9. Behaviour is unchanged: e2e specs `00` to `14` pass with their test hooks intact.
10. typecheck, lint, build, unit and the full integration suite pass, smoke passes, and one independent review with a computed-value critique against section 6 ran.

## 3. Decisions already made

- **Direction (owner's instruction, 2026-10-22).** Match Pipedrive's current web app as closely as possible. This replaces the planner's earlier "own identity" draft.
- **Source of truth for values.** Section 6, measured by the planner from live-app captures:
  - colours sampled from pixels;
  - sizes converted from 2× and 1.875× captures to CSS px;
  - type sizes from cap and x-heights with Inter metrics.

  Where Pipedrive was not captured (inbox, calendar, documents, insights, projects, settings), the spec extends the same measured system and says so. The builder never invents values outside section 6.
- **Typeface.** Inter, already vendored and loaded by `next/font/local` (warpdrive chose it for Pipedrive parity, and the captured glyphs match). No font change.
- **Structure changes for parity (restyle and markup layout only; no behaviour change):**
  - The page title moves from the content area into the top bar.
  - The rail becomes icon-only with tooltips.
  - Deal sidebar sections become flush full-width rows instead of separate cards.
  - Board column headers get Pipedrive's chevron shape.
  - The stage chevrons on the deal page become Pipedrive's 24 px day-count track.
- **Wording.** Keep warpdrive's Pipedrive-style wording ("Click here to add an activity…", "Pin filters", "+ Deal"). Use sentence case everywhere except Pipedrive's uppercase status badges (OVERDUE, NEW, plan tags), which are a primitive in `src/components/ui/`.
- **Dark mode.** Kept through the existing appearance menu (`src/features/theme/`) with the derived palette in 6.4. It is not a parity target, so the dark gallery is a sanity check only.
- **Mobile.** Part 10's layouts stay, restyled with these tokens. The bottom nav uses the rail's indigo and violet.
- **Reading screenshots.** The builder model reads text only, so the critique compares computed styles with section 6 (`qa` subagent). The owner reviews the gallery once at the end.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p10-v1` and `STATUS: COMPLETE` | log a Decision describing what you found; continue |
| Docker | `docker info` answers and the VM has at least 10 GB free | recover once (`open -a Docker`, `pnpm dev:up`); if it still fails, it is fatal: `STATUS: BLOCKED` with an Owner action |
| Kit location | `PLAN-PART11.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part11-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| Theme switch | `src/features/theme/` applies `.dark` on `<html>` from the user's choice | if dark never applies, set the class before paint from the stored choice and log it |
| Style guards | `src/paletteTokens.test.ts`, `src/typeScale.test.ts`, `src/app/globalsDarkVariant.test.ts` exist | keep them passing; update allow-lists only where this plan changes the contract, and log each |
| Inter | `src/app/fonts/inter-latin-var.woff2` is loaded in `src/app/layout.tsx` | keep it; no font work |
| axe | `npm view @axe-core/playwright version` prints 4.14.0 | pin the printed 4.x version |
| pnpm 9, subagent | as in Part 10 | as in Part 10 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P10.md` → Environment into PROGRESS.md → Environment and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed; `pnpm install` fails for a registry reason; Docker is down at Task 0.1 (above).

## 5. Target structure

```
src/app/globals.css                       # tokens (6.4), base styles, utilities, board column shape
src/components/ui/*                       # primitives restyled (6.6); new page-toolbar.tsx, panel.tsx, kbd.tsx, status-badge.tsx, table-styles.ts
src/components/shell/*                    # rail, top bar (title slot), bottom nav, more sheet (6.7)
src/components/shell/pageTitle.tsx        # PageTitle context + usePageTitle(title, info?)
src/features/deals/ui/StageTrack.tsx      # Pipedrive day-count track (6.8.2)
scripts/dealflow/check-design.mjs         # 6.3, exactly
scripts/dealflow/hex-to-hsl.mjs           # helper used once to fill channel tokens
e2e/15-design.spec.ts, e2e/design/{routes.ts,styleChecks.ts}
e2e/screenshots/design/*.png
docs/dealflow/DESIGN.md                   # the parity spec as built, tokens, components, opt-out policy
docs/dealflow/DESIGN-WORKLIST.md          # check-design baseline per file (Task 0.1) and final zero
```

## 6. Contracts

### 6.1 Differences to close (current Dealflow vs Pipedrive)

Measured by the planner on 2026-10-22, comparing Dealflow's e2e screenshots with Pipedrive captures. Every row is closed by a task.

| # | Area | Dealflow today | Pipedrive (target) | Task |
|---|---|---|---|---|
| 1 | Rail | 232 px slate-navy rail with text labels and a "Collapse" item. Its background stops after the last item | 56 px full-height indigo `#211C52` icon-only rail. Brand mark on top. Items 44×44 tiles; active tile violet `#6250E2`. Labels in a dark tooltip `#20232C` | 1.1 |
| 2 | Top bar | "Dealflow" wordmark left, centred search, square green add button, sparkle and bell icons | 56 px white bar, bottom border `#E8E8E8`. Page title left (16/600) with an info icon. Search pill 240×40 with `#CACACA` border. 40 px round add button. "AI chat" pill `#F6F4FF`. Icon buttons. 40 px initials avatar | 1.1 |
| 3 | Page title | 25 px title inside the content | Title in the top bar. Content starts with a 64 px toolbar row (view switcher, primary split button, right-side controls) | 0.3, all screens |
| 4 | Buttons | Green `#047857`, 36 px, radius 8 | Green `#2D8548`, 32 px, radius 4, 14/600. Secondary: white, `#CACACA` border | 0.3 |
| 5 | Text colours | Slate `#0F172A` and `#64748B` | `#21232C` primary, `#65686F` secondary, `#929196` placeholder | 0.2 |
| 6 | Links | Indigo `#4338CA` | Record links green `#017737`. Navigational links, active tabs and sort controls blue `#1168C9` | 0.2, screens |
| 7 | Canvas | Light grey content background | White for board and list pages. `#F5F5F5` for the deal page's activity side and board columns | 0.2, 1.2, 1.3 |
| 8 | Board columns | Plain columns | `#F5F5F5` columns 248 wide, radius 8, chevron-shaped header (title 16/600, meta 13 `$700 · 2 deals`) | 1.2 |
| 9 | Deal cards | Rounded cards with shadow | White, 1 px `#E3E3E3` border, radius 4, padding 8/10. Title 14/600, subtitle 13 secondary, avatar 20 plus value 13/600 secondary. Next-activity dot 16 px (`#58CC85` green, `#CBCCCE` grey, `#D73C38` red) | 1.2 |
| 10 | Deal stage bar | Light tinted chevrons with stage names | 24 px track. Passed and current segments green `#2D8548` with white "17 days"; future segments `#E4E4E4` with secondary "0 days". Chevron joins, radius 4 at the ends. A "Pipeline → Stage" blue breadcrumb below | 1.3 |
| 11 | Deal sidebar | Separate rounded cards on a grey background | One flush white column 400 wide with a right border. Section rows 64 high (title 16/600, chevron 20, "…" menu right), with 1 px `#E3E3E3` dividers | 1.3 |
| 12 | Deal activity side | White | `#F5F5F5` area, padding 24. White composer card, radius 8, `#E8E8E8` border. Tabs 40 high; active tab `#EFF6FF` with blue text and a 2 px blue underline | 1.3 |
| 13 | Deal header | Owner, follower, Won/Lost on one line | Title 24/400. Owner block (avatar 32, name 14/600, "Owner" 13 secondary, caret). "1 follower" secondary button. Won `#2D8548` and Lost `#D73C38` 32 px buttons. View menu and "…" icon buttons | 1.3 |
| 14 | Lists | Shadcn table look | Gridded table: header 33 high, 14/600, `#CACACA` bottom border, `#E5E5E5` column lines. Rows 33 high, 14/400, `#E5E5E5` separators. Record links green. Round done marker 18 px `#C3C3C3`. Type chips `#EFF6FF` with blue text | 1.4 |
| 15 | Badges | Pill badges | Uppercase status badges (OVERDUE red fill, white 12/700; plan tag blue outline `#AFC1EF` on `#EDF2FF` with `#2A53C5` text; NEW blue `#2677EA` pill) | 0.3 |
| 16 | Notes | White | Note cards yellow `#FFF6D5` | 1.3 |
| 17 | Mobile nav | Slate | Bottom nav and More sheet in rail colours | 1.1 |

### 6.2 Dependencies, scripts and error IDs

- Add `@axe-core/playwright@4.14.0` (dev).
- Add the script `check:design`: `node scripts/dealflow/check-design.mjs`.
- No error IDs.

### 6.3 `scripts/dealflow/check-design.mjs` (write exactly)

```js
#!/usr/bin/env node
// Flags styling that bypasses the Dealflow design system. Usage: node scripts/dealflow/check-design.mjs [files...] [--json out.json]
// No args: scans src/**/*.tsx. Lines containing "design-ok:" followed by a reason are skipped (and counted).
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const RULES = [
  { id: "font-size", re: /\btext-\[\d/ , msg: "arbitrary font size; use the type scale" },
  { id: "radius", re: /\brounded-(?:\[|2xl\b|3xl\b|xs\b)/, msg: "off-scale radius; use rounded-sm|md|lg|xl|full" },
  { id: "shadow", re: /(?<![\w-])shadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?![\w-])/, msg: "shadow on a non-floating element", skipUi: true },
  { id: "uppercase", re: /\buppercase\b/, msg: "all caps outside StatusBadge; use sentence case", skipUi: true },
  { id: "overlay", re: /\bfixed\s+inset-0\b/, msg: "custom overlay; use Dialog or Sheet", skipUi: true },
  { id: "raw-colour", re: /\b(?:bg|text|border|fill|stroke|ring|outline|from|to)-\[(?:#|rgb|hsl)/, msg: "raw colour; use a token" },
  { id: "palette", re: /\b(?:bg|text|border|ring|fill|stroke|outline|divide)-(?:red|green|blue|emerald|indigo|amber|yellow|orange|sky|violet|purple|pink|rose|teal|cyan|lime|fuchsia|gray|slate|zinc|neutral|stone)-\d{2,3}\b/, msg: "Tailwind palette step; use a token" },
];
const PAGE_RULE = { id: "page-title", msg: "app page without PageTitle/usePageTitle or PageToolbar" };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(p)) out.push(p);
  }
  return out;
}
const args = process.argv.slice(2);
let jsonOut = null; const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json") { jsonOut = args[++i] ?? null; continue; }
  targets.push(args[i]);
}
const expand = (t) => { const p = join(ROOT, t); return statSync(p).isDirectory() ? walk(p) : [p]; };
const files = (targets.length ? targets.flatMap(expand) : walk(join(ROOT, "src"))).filter((f) => f.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(f));

const report = {}; let total = 0; let optOuts = 0;
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const isUi = rel.startsWith("src/components/ui/");
  const lines = readFileSync(file, "utf8").split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (/design-ok:\s*\S/.test(line)) { optOuts++; return; }
    for (const r of RULES) {
      if (r.skipUi && isUi) continue;
      if (r.re.test(line)) hits.push({ line: i + 1, rule: r.id, msg: r.msg });
    }
  });
  if (/^src\/app\/\(app\)\/.*\/page\.tsx$/.test(rel)) {
    const src = lines.join("\n");
    if (!/PageTitle|usePageTitle|PageToolbar/.test(src) && !/design-ok:/.test(src)) hits.push({ line: 1, rule: PAGE_RULE.id, msg: PAGE_RULE.msg });
  }
  if (hits.length) { report[rel] = hits; total += hits.length; }
}
for (const [f, hits] of Object.entries(report)) {
  console.log(`${f} (${hits.length})`);
  for (const h of hits) console.log(`  ${h.line}: [${h.rule}] ${h.msg}`);
}
console.log(`check-design: ${total} violation(s) in ${Object.keys(report).length} file(s); ${optOuts} opt-out(s)`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ total, optOuts, files: report }, null, 2));
process.exit(total > 0 || optOuts > 40 ? 1 : 0);
```

Arguments may be files or directories. If a line of this script misbehaves, fix that line only, keeping the behaviour in the header comment, and log it.

### 6.4 Tokens (light is the parity theme)

**Channel conversion.** Keep the existing HSL-channel convention for shadcn tokens. Convert each hex below with `scripts/dealflow/hex-to-hsl.mjs`, a 20-line helper that prints channels to one decimal place. Non-channel tokens stay raw values. The `.dark` block mirrors every key.

| Token | Light (Pipedrive, measured) | Dark (derived) | Use |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#1B1D22` | page canvas (board, lists, settings, deal header area) |
| `--canvas-subtle` | `#F5F5F5` | `#15171B` | board columns, deal activity side, sidebar hover rows |
| `--card`, `--popover` | `#FFFFFF` | `#24272E` | cards, composer, menus, dialogs |
| `--muted`, `--secondary`, `--accent` | `#F4F4F4` | `#2C3038` | hover fills, skeletons |
| `--foreground` (+ card/popover/secondary/accent foregrounds) | `#21232C` | `#E8E9EC` | primary text |
| `--muted-foreground` | `#65686F` (5.6:1 on white) | `#A3A6AD` | secondary text, meta, inactive tabs |
| `--placeholder` | `#929196` | `#7D8088` | placeholders, disabled text |
| `--border` | `#E3E3E3` | `#353943` | card borders, section dividers |
| `--border-strong` / `--input` | `#CACACA` | `#4A4F5A` | control borders, search pill, table header rule |
| `--grid` | `#E5E5E5` | `#30343D` | table column and row lines |
| `--topbar-border` | `#E8E8E8` | `#30343D` | top bar bottom border |
| `--primary`, `--action`, `--save`, `--success` | `#2D8548` (4.6:1 with white text) | `#3FA864` | primary buttons, Won, passed stages |
| `--primary-hover` | `#256F3C` | `#4DB872` | primary hover |
| `--primary-foreground`, `--action-foreground` | `#FFFFFF` | `#FFFFFF` | text on green |
| `--link-record` | `#017737` | `#52C27A` | record links in tables and cards |
| `--link`, `--info`, `--ring` | `#1168C9` | `#5EA2F0` | blue links, active tab, sort control, breadcrumb, focus ring |
| `--info-soft` | `#EFF6FF` | `#1E2A3D` | active tab, selected view segment, chips, sort pill |
| `--info-soft-strong` | `#E1EEFF` | `#233552` | selected filter chip (History "All") |
| `--destructive` | `#D73C38` (4.6:1 with white text) | `#EE6461` | Lost, delete, overdue, count badges |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | |
| `--warning` | `#F5A623` | `#F5B547` | rotting and warning markers (not captured; Pipedrive's amber) |
| `--warning-soft` | `#FFF6D5` | `#3A3320` | note cards, the tips bulb circle |
| `--next-green` / `--next-grey` / `--next-red` | `#58CC85` / `#CBCCCE` / `#D73C38` | `#58CC85` / `#5A5E66` / `#EE6461` | next-activity dot on deal cards |
| `--rail` | `#211C52` | `#16133A` | navigation rail, bottom nav |
| `--rail-active` | `#6250E2` | `#6F5FE8` | active rail tile |
| `--rail-foreground` | `#FFFFFF` | `#FFFFFF` | rail icons |
| `--rail-hover` | `#2E2868` | `#221E52` | rail tile hover |
| `--tooltip` / `--tooltip-foreground` | `#20232C` / `#FFFFFF` | `#3A3E48` / `#FFFFFF` | tooltips |
| `--ai-soft` / `--ai` | `#F6F4FF` / `#6250E2` | `#26224A` / `#9C90F5` | "AI chat" pill and sparkle |
| `--badge-plan-bg` / `--badge-plan-border` / `--badge-plan-fg` | `#EDF2FF` / `#AFC1EF` / `#2A53C5` | `#1E2A4D` / `#3B5291` / `#AFC1EF` | uppercase plan tags |
| `--badge-new` | `#2677EA` | `#4C8EF0` | NEW pill |
| `--avatar` / `--avatar-foreground` | `#EBEBEB` / `#5E6066` | `#3A3E48` / `#C7C9CE` | initials and placeholder avatars |
| `--chart-1` to `--chart-6` | `#2D8548` `#1168C9` `#6250E2` `#F5A623` `#D73C38` `#65686F` | `#3FA864` `#5EA2F0` `#8E80F0` `#F5B547` `#EE6461` `#A3A6AD` | chart series (each ≥ 3:1 on white except amber, which is used with labels) |

**Contrast note.** `#2D8548` with white text measures 4.6:1 and `#D73C38` with white text 4.6:1, so both pass AA for 14 px/600 button labels. `#65686F` on white measures 5.6:1. If axe flags a combination, use the smallest darkening step of that one token that passes, and log it as a `CONTRACT CHANGE:` with both ratios.

**Radius** (in the `@theme` block, replacing the `calc(var(--radius) ...)` lines):
- `--radius-sm: 2px` (checkboxes);
- `--radius-md: 4px` (buttons, inputs, cards, chips, badges, segmented controls, stage track ends);
- `--radius-lg: 8px` (board columns, composer card, menus, popovers, dialogs, toasts);
- `--radius-xl: 8px` (sheets);
- `rounded-full` for the search pill, the round add button, the AI pill, avatars, next-activity dots, NEW and OVERDUE pills, and count badges.

Shadcn primitives already use `rounded-md` for controls and `rounded-lg` for cards, so most components follow automatically.

**Type** (Inter; keep Tailwind's names):

| Use | Size / line-height / weight |
|---|---|
| Body, controls, table cells (`text-sm`) | 14/20/400 |
| Buttons and table headers | 14/20/600 |
| Meta and secondary (add `--text-meta`, `text-meta`) | 13/18/400 |
| Badges and captions (`text-xs`) | 12/16, badges 12/16/700 uppercase |
| Top-bar page title, section titles, column titles (`text-base`, with `font-semibold`) | 16/24/600 |
| Deal and record titles (add `--text-title`, `text-title`) | 24/32/400 |

- Remove `--text-display`; replace its uses with `text-base font-semibold` in the top bar and `text-title` for record titles.
- Body `letter-spacing: 0`.
- Add a `.tabular` utility (`font-variant-numeric: tabular-nums`) for values, counts and dates in tables and cards.

**Spacing:**
- content padding 16;
- toolbar row 64 (16 top, 32 controls, 16 bottom);
- filter row 40;
- board column inner padding 8;
- card padding 8 vertical, 10 horizontal;
- deal header padding 24 horizontal, 20 top;
- sidebar row padding 0 24;
- activity side padding 24;
- form field gap 16, with labels 6 above controls.

**Shadows:**
- `--shadow-card-hover: 0 1px 4px rgb(0 0 0 / 0.12)` (board card hover only);
- `--shadow-pop: 0 2px 8px rgb(0 0 0 / 0.16)` (menus, popovers, toasts);
- `--shadow-dialog: 0 4px 24px rgb(0 0 0 / 0.24)` (dialogs, sheets);
- `--shadow-drag: 0 6px 16px rgb(0 0 0 / 0.20)` (lifted board card).

Static cards, panels and columns have no shadow.

**Motion:** colour transitions 100 ms ease-out; overlays fade in 150 ms; nothing else animates; `prefers-reduced-motion` disables transforms.

**Focus:** `:focus-visible { outline: 2px solid var(--ring-hex); outline-offset: 2px }` globally (blue `#1168C9`).

**Public pages** wrap their root in `data-theme-lock="light"`. The appearance sync never adds `.dark` under it.

### 6.5 Layout components

- **`pageTitle.tsx`** (in `src/components/shell/`):
  - A `PageTitleProvider` in the app layout and `usePageTitle(title: string, opts?: { info?: string })`, called by every app page's client root (or a tiny `<PageTitle title="Deals" />` component for server pages).
  - The top bar renders the title at 16/600 `#21232C`, followed by a 20 px info-circle icon button in secondary colour when `info` is given. The button opens a tooltip with the text.
- **`page-toolbar.tsx`:** `PageToolbar({ left?, primary?, right? })`.
  - A row 64 high with padding 16 0, so controls sit 32 high.
  - `left` holds the view switcher, `primary` the main split button (8 px after `left`), and `right` the count, the pipeline menu and the filter button, gap 8, right-aligned.
  - Below 768 it wraps to two rows.
  - `check-design` requires `PageToolbar` or `PageTitle` in every app `page.tsx` (6.3).
- **`panel.tsx`:** `Panel({ title?, actions?, children, padded = true, tone = "card" })`.
  - `bg-card`, 1 px `border`, `rounded-lg`, no shadow.
  - Header 48 high, padding 0 16, title 16/600, actions right.
  - Body padding 16.
  - Used for settings sections, dashboard widgets and the composer.
- **`kbd.tsx`:** height 20, padding 0 6, `rounded-md`, `bg-muted`, `text-xs` secondary.
- **`status-badge.tsx`:** `StatusBadge({ tone: "overdue" | "plan" | "new" | "neutral" })` renders the uppercase badges from 6.1 row 15:
  - height 20, padding 0 6, 12/16/700;
  - overdue and new are pills;
  - plan is `rounded-md` with a 1 px border.

  This is the only place `uppercase` is allowed (`check-design` skips `src/components/ui/`).

### 6.6 Primitives (restyle `src/components/ui/*`, keeping APIs and test ids)

**Button**
- Sizes: `sm` 28, `md` 32 (default), `lg` 40. Padding 0 12. `rounded-md` (4). Text 14/600. Icon 16, gap 6.
- Variants:
  - `default`/primary: `#2D8548` background, white text, hover `#256F3C`, active `brightness-95`.
  - Split primary: a 32×32 caret segment with a 1 px `rgb(255 255 255 / 0.25)` divider.
  - `secondary`/`outline`: white background, 1 px `#CACACA` border, `#21232C` text, hover `#F4F4F4`.
  - `ghost`: transparent, secondary-colour icon, hover `#F4F4F4`.
  - `destructive`: `#D73C38`.
  - `success` (Won): `#2D8548`.
  - `link`: `#1168C9`, no underline, underline on hover.
  - `icon`: 32×32 secondary.
  - `round`: 40×40 `rounded-full` with a `#CACACA` border, for the top bar add button.
- Disabled: `#F4F4F4` background, `#929196` text, no opacity dimming.
- Loading: a 14 px spinner before the label.
- Touch: `min-h-10` below 768 (from Part 10).

**Segmented view switcher** (new `ViewSwitcher` in `src/components/ui/view-switcher.tsx`, used on board, list, forecast and archive views)
- Segments 48×32 with a 1 px `#CACACA` border and joined `rounded-md` ends.
- The selected segment has an `#EFF6FF` fill, a 1 px `#1168C9` border and a blue icon. Unselected segments have a white fill and a `#21232C` icon.

**Fields** (Input, Textarea, Select trigger, Combobox, DatePicker, TimePicker)
- Height 32, padding 0 8, `rounded-md`, 1 px `#CACACA` border, white fill, 14/20 text, placeholder `#929196`.
- Hover: border `#929196`.
- Focus: border `#1168C9` and `box-shadow: 0 0 0 1px #1168C9`.
- Error: border `#D73C38` with a 13 px `#D73C38` message below.
- Labels 13/500 secondary.

**Search pill** (top bar): 240×40 `rounded-full`, 1 px `#CACACA` border, a 20 px search icon at left 12, placeholder "Search Dealflow" 14 `#65686F`, and a `Kbd` "⌘K" at the right.

**Small controls**
- Checkbox: 18 px, `rounded-sm`, 1 px `#CACACA` border; checked `#1168C9` fill with a white check.
- Done marker (activities): an 18 px circle with a 1.5 px `#C3C3C3` border; done shows a `#2D8548` fill with a white check.
- Switch: 32×18, track `#CACACA`; on `#2D8548`.
- Radio: 18 px.

**Chips** (activity type filter chips, history filters)
- Height 24, padding 0 8, `rounded-md`, `#EFF6FF` fill, `#1168C9` text 14/500 with a 16 px icon.
- The selected history chip uses `#E1EEFF` and 600 weight. Unselected history chips have no fill and `#21232C` 600 text.

**Sort control:** a 32 px `#EFF6FF` pill-rectangle (`rounded-md`) with blue 14/600 "Sort by: {field}" and a caret. The direction toggle is a 32×32 `#EFF6FF` square with a blue arrow.

**Tabs** (composer and detail tabs)
- Height 40, padding 0 16, 14/500 `#65686F` with a 16 px icon.
- Active: `#EFF6FF` background, `#1168C9` text and icon, and a 2 px `#1168C9` bottom border.
- The tab list has a 1 px `#E3E3E3` bottom border.

**Overlays**
- **Dropdown menu, popover, combobox list:** white, 1 px `#E3E3E3` border, `rounded-lg`, `--shadow-pop`, padding 4. Items are 32 high, padding 0 12, `rounded-md`, hover `#F4F4F4`; the selected item is `#EFF6FF` with blue text. Separator 1 px `#E3E3E3`.
- **Tooltip:** `#20232C` background, white 13/18 text, padding 4 8, `rounded-md`. An optional count chip uses `rgb(255 255 255 / 0.16)`, `rounded-md`, padding 0 6.
- **Dialog:** `rounded-lg`, `--shadow-dialog`.
  - Header 56 high, padding 0 24, title 16/600, with a close icon at right and a 1 px bottom border.
  - Body padding 24.
  - Footer 64 high with a top border; actions sit right with gap 8 and primary rightmost; secondary actions sit left.
  - Widths: sm 480, md 600, lg 800. The overlay is `rgb(33 35 44 / 0.5)`.
- **Sheet:** width 480, `rounded-l-lg`, the same header and footer as Dialog.
- **Toast:** `#20232C` background, white 14 text, `rounded-lg`, padding 12 16, `--shadow-pop`. The action is a white 14/600 link. The error tone has a 3 px `#D73C38` left bar.

**Content states**
- **EmptyState:** a 64 px secondary-colour icon, title 16/600, text 14 secondary max 48ch, and an optional primary button. Centred, padding 48.
- **Skeleton:** `#F4F4F4` blocks, `rounded-md`, with a shimmer unless reduced motion is set.
- **Progress:** height 4, `rounded-full`, track `#E4E4E4`, bar `#2D8548`.
- **Avatar:** sizes 20, 32 and 40, `rounded-full`, `#EBEBEB` fill with initials 600 in `#5E6066` (40 px uses 14 px initials). The placeholder person glyph is `#A3A6AD`.
- **Count badge** (rail, bell): a min-width 18, height 18 `#D73C38` pill with white 11/700 text and a 2 px ring in the parent's background colour.

**Table** (shared `tableStyles` in `src/components/ui/table-styles.ts`, used by every list)
- Header row 33 high, white, 14/600 `#21232C`, padding 0 12, with a 1 px `#CACACA` bottom border and 1 px `#E5E5E5` column separators.
- Body rows 33 high, 14/400, a 1 px `#E5E5E5` bottom border, column separators `#E5E5E5`, and hover `#F4F4F4`. Selected rows are `#EFF6FF`.
- The first column is a 48 px checkbox column. Record links are `#017737`. Numbers are right-aligned `.tabular`.

### 6.7 Shell

**Rail** (desktop ≥ 768)
- `bg-rail` (define `--color-rail`, `--color-rail-active`, `--color-rail-hover` and `--color-rail-foreground` in `@theme`).
- 56 wide and the full viewport height (fixes the rail stopping after its last item).
- **Top:** the Dealflow mark (our logo, white, 28 px) in a 56×56 cell.
- **Items:**
  - icon-only 44×44 tiles, centred with 6 px side insets and 8 px between tiles;
  - `rounded-lg` (8), icon 24 white;
  - hover `--rail-hover`; active `--rail-active` violet.
- **Labels:** each tile has a tooltip to the right (6.6) with the nav label and optional count.
- **Count badges:** on the tile's top-right corner.
- Items keep their current order and routes. The "Collapse" control and the text labels are removed.
- Settings, help and profile stay in the top bar (as in Pipedrive); Settings moves into the avatar menu, which already has the account entries.
- Remove `LeftNav.tsx` from the palette test's intentional exceptions once it uses rail tokens.

**Top bar**
- Height 56, white, 1 px `#E8E8E8` bottom border, padding 0 16 0 24.
- **Left:** the page title (6.5).
- **Centre-right:** the search pill (6.6), then 16 px gap, the `round` add button (`+` icon, opens the create menu), 16 px gap, then the "AI chat" pill:
  - 40 high, `rounded-full`, `--ai-soft` fill, padding 0 16;
  - a 16 px `--ai` sparkle icon and 14/600 `#21232C` label "AI chat";
  - it opens the existing assistant sheet.
- **Right:** 40×40 ghost icon buttons for notifications (bell with count badge) and help (the docs link), then the 40 px initials avatar (menu: profile, settings, appearance, install app, log out).

**Bottom nav** (< 768): height 56 plus the safe area, `bg-rail`. Items are 24 px white icons with 11/600 labels at 70% white; the active item gets a violet 32×32 tile behind its icon. The More sheet has a `bg-card` body with a rail-coloured header strip.

**Content:** the white canvas. Each page is the toolbar row, then the filter row if any, then content, with page padding 16 (24 on the deal page).

### 6.8 Screens

Each screen keeps every test hook. The ids in brackets are gallery screens (6.10).

1. **Pipeline board** (`board`). Measured.
   - **Toolbar:**
     - left: view switcher (board, list, forecast, archive);
     - primary: "+ Deal" split button;
     - right: "{n} deals" 14 `#21232C` plus info icon, the pipeline menu (secondary button with a board icon, pipeline name 14/600, caret, joined to a 32×32 pencil segment), and "Filter" (secondary, filter icon, caret).
   - **Filter row:** "Pin filters" (pin icon plus 14/600 secondary) at left; the sort direction toggle and the "Sort by: Next activity" control at right.
   - **Columns:**
     - 248 wide, `--canvas-subtle` fill, `rounded-lg` top-left, 4 px apart, full height of the viewport below the filter row.
     - Header 64 high, padding 12 12 0, title 16/600 (single line, truncated), meta 13 secondary "{value} · {n} deals".
     - The header's right edge is a chevron: `clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 32px, calc(100% - 8px) 64px, calc(100% - 8px) 100%, 0 100%)` on the column, with the next column's header offset 8 px under the tip. Implement it in `globals.css` as `.board-column`.
   - **Cards:**
     - padding 8 10, 4 px gap between cards, card width = column − 16;
     - title 14/600 (one line, truncated), subtitle 13 secondary "{org}, {person}" (one line);
     - footer row with a 20 px avatar, 6 px gap, value 13/600 secondary `.tabular`, and label chips if any;
     - the next-activity dot (16 px, white chevron) right-centred;
     - the Part 7 score badge as a 20 px `rounded-md` chip before the dot;
     - rotting: card left border 3 px `--warning`;
     - hover: `--shadow-card-hover`;
     - dragging: `--shadow-drag` and a 2° rotation (`design-ok`, floating).
   - **Drag action bar** (bottom, shown while dragging): four 64 px high drop zones, "Delete", "Lost", "Won", "Move to". Each has a dashed 1 px border; "Lost" and "Won" are tinted red and green at 8%; 13/600 uppercase labels belong to the status badge primitive or carry an opt-out with a reason.
2. **Deal workspace** (`deal`). Measured.
   - Top bar title "Deals".
   - **Header** (white, padding 20 24 16):
     - row 1: the deal title 24/400 at left; at right, the owner block, the "{n} follower" secondary button with caret, Won and Lost (32 high, 62 wide), the layout menu button (icon plus caret) and the "…" icon button, gap 12;
     - row 2 (12 px below): the **StageTrack** (`StageTrack.tsx`), full width, 24 high. Segments are equal width and joined by 8 px chevrons (a clip-path arrow with a 2 px white gap). Passed and current segments are `#2D8548` with white 13/400 "{n} days"; future segments are `#E4E4E4` with `#65686F` text. The ends are `rounded-md`. Each segment's tooltip shows the stage name. Clicking keeps the existing stage-change behaviour;
     - row 3 (8 px below): the breadcrumb "{Pipeline} → {Stage}" in blue 14 links with a secondary arrow.
     - A 1 px `#E4E4E4` rule under the header.
   - **Body:** two columns.
     - **Sidebar:** 400 wide, white, 1 px right border.
       - Each section (Summary, Products, Documents, Projects, AI insights, Source, Person, Organization, Details, Overview) is a row 64 high: padding 0 24, a 20 px chevron, title 16/600, an optional `StatusBadge`, and the "…" or info icon at right.
       - The expanded content sits below its row with padding 0 24 16 56. Field rows are label 13 secondary over value 14, or two-column 140/1fr where warpdrive already uses label/value pairs.
       - Rows are separated by 1 px `#E3E3E3`; hover `#F4F4F4`.
     - **Activity side:** `--canvas-subtle`, padding 24.
       - **Composer card:** white, `rounded-lg`, 1 px `#E8E8E8` border. The tab row (Activity, Notes, Meeting scheduler, Call, Email, Files, Documents, Invoice) wraps. The placeholder row is 64 high: "Click here to add an activity…" 14 `#929196`.
       - **Then:** "Focus" (16/600 with caret), 16 px gap, focus items; then "History" (16/600 with caret), the filter chips row (All, Activities ({n}), Notes ({n}), Email ({n}), Files, Documents, Invoices, Changelog), then timeline items.
       - **Timeline:** a 40 px white circle icon with a 1 px border on the left, joined by a 1 px dashed `#CACACA` line; items are white cards (`rounded-lg`, 1 px border, padding 12 16); notes are `--warning-soft`. Overdue items use the OVERDUE badge and red 13 date text.
3. **Lists** (`deals-list`, `people`, `organizations`, `leads`, `activities-list`). Activities measured.
   - **Toolbar:** the view switcher where a list has views; a primary split "+ {Entity}"; right controls as on the board.
   - **Activities filter row:** "All" 14/600, a 1 px divider, then the type chips (6.6).
   - **Table:** `tableStyles` on the white canvas, edge to edge inside the 16 px padding, with no panel around it.
   - **Mobile:** Part 10 cards become white rows separated by 1 px lines.
4. **Person and organization detail** (`person`): the same structure as the deal page without the StageTrack. Header: avatar 40, name 24/400, owner block, actions.
5. **Inbox and thread** (`inbox`, `thread`). Derived from the system.
   - **Folders:** 220 wide white column, items 32 high, active `#EFF6FF` with blue text.
   - **Thread list:** 360 wide. Rows 72 high with padding 12 16: sender 14/600, subject 14, snippet 13 secondary, time 13 secondary right. Unread rows get a 6 px blue dot; selected rows are `#EFF6FF`.
   - **Reading pane:** `--canvas-subtle`, messages as white cards (`rounded-lg`, border).
   - **Mobile:** the reply composer opens in a bottom `Sheet` (closes Part 10's open issue).
6. **Calendar** (`calendar`). Derived.
   - Grid lines `#E5E5E5`. Hour labels 12 secondary. The today column header uses a blue 600 date number in an `#EFF6FF` circle.
   - **Event chips:** `rounded-md`, a `#EFF6FF` fill with a 3 px left bar in `--chart-*` by activity type, title 13/600. Done chips are secondary with a line-through.
   - Agenda view on mobile.
7. **Forecast** (`forecast`): month columns styled as board columns without the chevron, with header meta "{total} · weighted {w}". Cards as on the board.
8. **Documents** (`documents`, `document`, public `public-quote`).
   - The list follows rule 3.
   - **Editor:** the deal-page split (sidebar 400 for status, actions and payments; the preview on `--canvas-subtle`). The document sheet is white, `rounded-lg`, 1 px border, padding 40, max width 860.
   - The public page shows the same sheet on `#F5F5F5` with the "Powered by Dealflow" footer at 12 secondary.
9. **Insights** (`insights`, `dashboard`, `report`).
   - Widgets are `Panel`s on `--canvas-subtle`, gap 16. Charts use `--chart-1..6`, axis text 12 secondary, gridlines `#E5E5E5`.
   - KPI tiles: value 24/600 `.tabular`, label 13 secondary.
   - Loading uses a `Skeleton` the height of the chart (replaces "Loading report...").
   - **Report builder:** the config column is 320 wide, white, right border, with fields in 16 px rows; the preview `Panel` sits on `--canvas-subtle`.
10. **Projects** (`projects`, `project`): the list follows rule 3. The board uses board columns without the chevron. Task cards follow the deal card (title 14/600, assignee avatar 20, due date 13 secondary, done marker).
11. **Settings** (`settings-profile`, `settings-automation`).
    - **Settings menu:** a left column 240 wide, white, right border. Group headings 13/600 secondary with 24 px top margin. Items 32 high, padding 0 16, 14; the active item is `#EFF6FF` with blue text and a 3 px blue left bar.
    - **Content:** white, padding 24, max width 800, sections as `Panel`s or flush blocks with 16/600 titles and 1 px dividers. Forms use one column with labels above.
    - **Automation editor:** "When / Only if / Then" as three `Panel`s joined by a 1 px `#CACACA` line.
12. **Auth and public** (`login`, `public-form`, `public-booking`, `offline`).
    - Always light, on `#F5F5F5`, with the content card white, `rounded-lg`, 1 px border, padding 32. Widths: sign-in 400, form 560, booking 720.
    - Primary buttons are green and full-width on sign-in.
    - **Booking:** day buttons 40×40 `rounded-md`; the selected day `#2D8548` with white text; slot buttons secondary 32 high; the selected slot is green.
13. **States** (every screen).
    - **Empty:** `EmptyState` with an action ("Add deal", "Add activity").
    - **Loading:** `Skeleton` rows shaped like the content (table rows 33 high; board cards 80 high).
    - **Error:** an inline row with a 3 px `#D73C38` left bar and `#FDECEC` fill, 14 text, and a "Try again" link button.

### 6.9 Wording

Keep the current Pipedrive-style wording. The only copy changes are:
- **Search placeholder:** "Search Dealflow".
- **Sentence case:** apply it to any table header or button that is currently in Title Case or ALL CAPS, except `StatusBadge`.
- **Toasts:** drop "successfully".

### 6.10 Design e2e (`e2e/15-design.spec.ts`)

**Screens.** `e2e/design/routes.ts` lists the 26 gallery screens with their routes; `{id}` routes resolve from the seeded fixtures:

`login`, `board`, `deal`, `deals-list`, `people`, `person`, `organizations`, `leads`, `activities-list`, `calendar`, `inbox`, `thread`, `forecast`, `documents`, `document`, `insights`, `dashboard`, `report`, `projects`, `project`, `settings-profile`, `settings-automation`, `public-quote`, `public-form`, `public-booking`, `offline`.

**Light pass, every screen:**
1. At 1440×900, wait for network idle and for no element with `[aria-busy="true"]`.
2. Run axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`) and assert zero `serious` or `critical` violations.
3. Take the screenshot `e2e/screenshots/design/{screen}-1440-light.png`.
4. At 375×812, assert `scrollWidth <= innerWidth + 1` and take `{screen}-375-light.png`.

**Dark pass, 21 app screens:** at 1440, set the appearance to dark, run axe, and take `{screen}-1440-dark.png`.

**Parity checks** (`e2e/design/styleChecks.ts`, light), on `board`, `deal`, `activities-list` and `settings-profile`. Each computed value must equal:

| Element | Expected computed value |
|---|---|
| `body` font family | includes "Inter" |
| `body` colour | `rgb(33, 35, 44)` |
| Rail | background `rgb(33, 28, 82)`, width 56 px, height = viewport height |
| Active rail tile | background `rgb(98, 80, 226)`, 44×44 |
| Top bar | height 56 px, border-bottom colour `rgb(232, 232, 232)` |
| Top-bar title | 16 px, weight 600 |
| Primary button | background `rgb(45, 133, 72)`, height 32 px, radius 4 px, 14 px/600 |
| Search pill | height 40 px, radius 20 px (or larger), border `rgb(202, 202, 202)` |
| Board column (`board`) | background `rgb(245, 245, 245)`, width 248 px |
| Deal card (`board`) | radius 4 px, border colour `rgb(227, 227, 227)`, `box-shadow: none` |
| Card title | 14 px/600 |
| StageTrack segment (`deal`) | height 24 px; passed background `rgb(45, 133, 72)`; future `rgb(228, 228, 228)` |
| Sidebar (`deal`) | width 400 px; section row height 64 px |
| Deal title | 24 px/400 |
| Activity side (`deal`) | background `rgb(245, 245, 245)` |
| Table row (`activities-list`) | height 33 px |
| Table header cell | 14 px/600; record link colour `rgb(1, 119, 55)` |
| Focus | pressing Tab from the page start focuses an element with `outline-style: solid`, 2 px, colour `rgb(17, 104, 201)` |

Themes are switched through the appearance setting the app already persists; find the setter, and e2e may set its storage key before load. Screenshot names are fixed by this list.

## 7. Conventions

Same as Parts 1 to 10 (CLAUDE.md is the authority). In addition:
- Restyle and layout only: never change behaviour, data or test hooks.
- Every visual value comes from section 6 through a token, scale step or primitive. Never eyeball a value, and never introduce a value section 6 does not give.
- `check-design` is the referee. An opt-out (`design-ok: {reason}`) is allowed only where a rule genuinely does not apply (drag overlay, third-party chart internals). At most 40 opt-outs; the `qa` subagent reviews each.
- Floating shadows and overlays are owned by `src/components/ui/`.
- Each screen task's Verify includes `pnpm check:design {its files}` → 0, plus its gallery screens.

## 8. Phases and tasks

### Phase 0: Start, tokens, primitives and the design harness

#### Task 0.1 - Start Part 11: progress files, kit, baseline and design worklist

**Goal:** A Part 11 PROGRESS.md, a green baseline, and the `check-design` baseline.

**Files:** create `PROGRESS.md`, `scripts/dealflow/check-design.mjs`, `docs/dealflow/DESIGN-WORKLIST.md`; rename `PROGRESS.md` → `PROGRESS-P10.md`; modify `package.json` (script); possibly root symlink `PLAN-PART11.md`, `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P10.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P10.md` → Environment;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, create the root symlink and the byte-identical checker copy.
4. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:unit`. Log `- Baseline: ...`.
5. Write `check-design.mjs` exactly as 6.3, add `check:design`, and run `pnpm check:design --json /tmp/design-baseline.json`.
6. Write `DESIGN-WORKLIST.md` (the planner's read-only dry run on 2026-10-22 found 289 violations in 184 files; expect a similar count): the total, per-rule counts, the per-file list sorted by count with a "Task" column mapping each file to its section 8 task (unmapped files go to Task 3.4), and a copy of the 6.1 differences table with a "Closed in" column left empty.
7. Commit `0.1: Start Part 11: progress files, kit, baseline and design worklist`, tick.

**Verify:** `pnpm check:progress` → OK; `test -s docs/dealflow/DESIGN-WORKLIST.md`

**Done when:** PROGRESS.md lists all tasks and the worklist records the baseline.

#### Task 0.2 - Tokens and global styles

**Goal:** 6.4 in `globals.css` (light parity, dark derived), radius, type, spacing helpers, shadows, motion, focus, `.tabular`, `.board-column`, and the public light lock.

**Files:** modify `src/app/globals.css`, `src/features/theme/*` (light lock), `src/paletteTokens.test.ts`, `src/typeScale.test.ts`, `src/app/globalsDarkVariant.test.ts` (allow-lists only, logged); create `scripts/dealflow/hex-to-hsl.mjs`

**Steps:**
1. Write every token in light and dark, the `@theme` additions (rail colours, `--text-meta`, `--text-title`, radius scale), shadows, motion and focus.
2. Replace `--text-display` uses with the 6.4 equivalents.
3. Add the light lock to the appearance sync.
4. Run the three guard tests and update their allow-lists to the new contract, never weakening a rule. Log each change.
5. Commit, tick.

**Verify:** `pnpm typecheck && pnpm exec vitest run src/paletteTokens.test.ts src/typeScale.test.ts src/app` → passes

**Done when:** the tokens exist in both themes and the guards pass.

#### Task 0.3 - Primitives and layout components

**Goal:** 6.5 and 6.6 in `src/components/ui/` and `src/components/shell/pageTitle.tsx`.

**Files:**
- modify every file in `src/components/ui/` that 6.6 names: Button, Input, Textarea, Select, Combobox, MultiCombobox, DatePicker, TimePicker, Checkbox, Switch, RadioGroup, Badge, tabs, dropdown-menu, Popover, tooltip, dialog, alert-dialog, sheet, toaster, EmptyState, Skeleton, Progress, Avatar;
- create `page-toolbar.tsx`, `panel.tsx`, `kbd.tsx`, `status-badge.tsx`, `view-switcher.tsx`, `table-styles.ts`, `src/components/shell/pageTitle.tsx`;
- update the primitives' own tests where they assert a changed class (log).

**Steps:**
1. Restyle each primitive per 6.6, keeping props, exports, roles and test ids.
2. Build the new components, with a unit test each covering structure and the uppercase badge.
3. Run the `src/components` tests.
4. Commit, tick.

**Verify:** `pnpm exec vitest run src/components && pnpm check:design src/components/ui` → passes and reports 0

**Done when:** every primitive matches 6.6.

#### Task 0.4 - Design e2e harness

**Goal:** `e2e/15-design.spec.ts`, `routes.ts`, `styleChecks.ts`, and the axe dependency.

**Files:** create those files; modify `package.json`, `pnpm-lock.yaml` (`@axe-core/playwright@4.14.0` dev)

**Steps:**
1. Build the spec per 6.10, with a `DESIGN_SCREENS` env filter (comma-separated list) and a `DESIGN_CHECKS=0` switch that skips the parity table, for phase gates whose screens are not done yet.
2. Run it once with `DESIGN_SCREENS=login DESIGN_CHECKS=0` and fix harness problems only.
3. Commit, tick.

**Verify:** `DESIGN_SCREENS=login DESIGN_CHECKS=0 pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** the harness runs and writes screenshots.

#### Task 0.5 - Phase 0 QA gate

**Goal:** Prove the foundation.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3) with the current `check-design` total. No `qa` review at this gate (fast profile). Record the Phase 1 base commit, commit `0.5: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design src/components/ui` → 0
- `DESIGN_SCREENS=login DESIGN_CHECKS=0 pnpm exec playwright test e2e/15-design.spec.ts` → passes

**QA focus:** Definition of done items 1 to 3; token values exactly as 6.4.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Shell and core screens

#### Task 1.1 - Shell

**Goal:** 6.7 (differences rows 1, 2 and 17).

**Files:** modify `src/components/shell/{LeftNav,TopBar,UserMenu,NavIcons,BottomNav,MoreSheet}.tsx` (and `src/features/navigation/mobile/*` if the Part 10 files live there), `src/app/(app)/layout.tsx` (mount `PageTitleProvider`), `src/paletteTokens.test.ts` (remove the LeftNav exception)

**Steps:**
1. Build the icon-only rail with tooltips and the top bar with the title slot, search pill, round add button, AI pill, icons and avatar menu (Settings moves into it).
2. Restyle the bottom nav and More sheet.
3. Run the shell tests; update ones that asserted removed rail labels to assert the tooltip label instead (log).
4. Commit, tick.

**Verify:** `pnpm check:design src/components/shell` → 0; `pnpm exec vitest run src/components/shell` → passes

**Done when:** the shell matches 6.7.

#### Task 1.2 - Pipeline board

**Goal:** 6.8.1 (differences rows 7 to 9).

**Files:** the board, column, column header, deal card, drag overlay and drag action bar components (find them under `src/features/deals/` and `src/features/pipelines/`); the board page (`PageTitle`, `PageToolbar`, `ViewSwitcher`)

**Steps:**
1. Restyle per 6.8.1, including the chevron column shape and the toolbar and filter rows.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=board pnpm exec playwright test e2e/15-design.spec.ts` → passes (the board parity checks included)

**Done when:** the board passes its parity checks.

#### Task 1.3 - Deal workspace and StageTrack

**Goal:** 6.8.2 (differences rows 10 to 13 and 16).

**Files:** create `src/features/deals/ui/StageTrack.tsx` (+ unit test: segment states, day labels, tooltip names); modify the deal workspace header, sidebar sections, composer, focus and history components (find them under `src/features/deal-workspace/` and `src/app/(app)/deals/[dealId]/`)

**Steps:**
1. Build StageTrack and restyle per 6.8.2. Replace the chevron stage component; delete it if no other screen uses it, and log the removal.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=deal pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** the deal page passes its parity checks.

#### Task 1.4 - Lists and person/organization detail

**Goal:** 6.8.3 and 6.8.4 (difference row 14).

**Files:** the deals list, people list and detail, organizations list and detail, leads inbox, and activities list components and pages

**Steps:**
1. Apply `tableStyles`, `PageTitle`, `PageToolbar` and the chips. Restyle the Part 10 mobile cards.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=deals-list,people,person,organizations,leads,activities-list pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** all six screens pass, including the activities parity checks.

#### Task 1.5 - Phase 1 QA gate

**Goal:** Prove the shell and core screens.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3) with the `check-design` total. No `qa` review at this gate (fast profile). Record the Phase 2 base commit, commit `1.5: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `DESIGN_SCREENS=board,deal,deals-list,people,person,organizations,leads,activities-list pnpm exec playwright test e2e/15-design.spec.ts` → passes
- the existing e2e specs that cover the board, deal page and lists (list the exact files found, for example `e2e/01-*.spec.ts`) → pass

**QA focus:** Definition of done items 3 to 5 for these screens; test hooks unchanged; parity values exact.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Secondary screens

#### Task 2.1 - Inbox, thread and mobile reply sheet

**Goal:** 6.8.5.

**Files:** inbox, folders, thread list, reading pane and composer components; the inbox page (`PageTitle`, `PageToolbar`)

**Steps:**
1. Restyle and add the mobile reply `Sheet`.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=inbox,thread pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** both screens pass and the reply opens in a sheet at 375.

#### Task 2.2 - Calendar and forecast

**Goal:** 6.8.6 and 6.8.7.

**Files:** calendar (week, month, day/agenda) and forecast components and pages

**Steps:**
1. Restyle per spec.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=calendar,forecast pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** both screens pass.

#### Task 2.3 - Documents and the public document page

**Goal:** 6.8.8.

**Files:** documents list, editor, `DocumentView`, the public page, print styles (print stays black on white)

**Steps:**
1. Restyle and apply the light lock on the public page.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=documents,document,public-quote pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** all three screens pass.

#### Task 2.4 - Insights and dashboards

**Goal:** 6.8.9, including skeleton loading.

**Files:** insights home, report builder, chart, KPI, dashboard and widget components; the stats pages that share them

**Steps:**
1. Restyle, add skeletons, and move chart colours to `--chart-*`.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=insights,dashboard,report pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** all three screens pass.

#### Task 2.5 - Projects

**Goal:** 6.8.10.

**Files:** projects list, board, phase column, task card and dialogs

**Steps:**
1. Restyle per spec.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=projects,project pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** both screens pass.

#### Task 2.6 - Phase 2 QA gate

**Goal:** Prove the secondary screens.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3) with the `check-design` total. No `qa` review at this gate (fast profile). Record the Phase 3 base commit, commit `2.6: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `DESIGN_SCREENS=inbox,thread,calendar,forecast,documents,document,public-quote,insights,dashboard,report,projects,project pnpm exec playwright test e2e/15-design.spec.ts` → passes

**QA focus:** Definition of done item 5 for these screens; derived screens use only section 6 values.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Settings, public pages, states and the remaining worklist

#### Task 3.1 - Settings

**Goal:** 6.8.11 across every settings page.

**Files:** the settings layout and menu, and every settings page: profile, notifications, users, permissions, pipelines, currencies, products, documents, automations and editor, webhooks, forms and editor, booking and editor, API, recycle bin, audit log, backups, email sync. Each gets `PageTitle`.

**Steps:**
1. Restyle one settings area at a time, committing inside the task.
2. Commit, tick.

**Verify:** `pnpm check:design "src/app/(app)/settings" src/features/settings` → 0; `DESIGN_SCREENS=settings-profile,settings-automation pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** every settings file is at 0 and both screens pass.

#### Task 3.2 - Auth and public pages

**Goal:** 6.8.12.

**Files:** the sign-in, magic-link and invite pages, `/f/{publicId}`, `/book/{publicId}`, `/book/cancel/{token}`, `/offline`, and `PoweredBy`

**Steps:**
1. Restyle per spec, always light.
2. Commit, tick.

**Verify:** `pnpm check:design {the changed files}` → 0; `DESIGN_SCREENS=login,public-form,public-booking,offline pnpm exec playwright test e2e/15-design.spec.ts` → passes

**Done when:** all four screens pass.

#### Task 3.3 - Empty, loading and error states

**Goal:** 6.8.13 everywhere.

**Files:** every component rendering an empty list, a loading text or an inline error. Search `src/features` and `src/app` for `Loading`, `No ` and `role="alert"`.

**Steps:**
1. Apply `EmptyState`, `Skeleton` and the error row.
2. Commit, tick.

**Verify:** `git grep -nE ">Loading[^<]*\\.\\.\\.<" -- src` prints nothing; `pnpm check:design` on the changed files → 0

**Done when:** no plain loading text remains.

#### Task 3.4 - Remaining worklist, wording and docs

**Goal:** `check-design` at 0 over all of `src`, 6.9 applied, and the docs.

**Files:** every file still in `DESIGN-WORKLIST.md`; create `docs/dealflow/DESIGN.md`; modify `docs/dealflow/DESIGN-WORKLIST.md` (final state with the 6.1 table "Closed in" column filled), `docs/dealflow/UPSTREAM.md`, `README.md`

**Steps:**
1. Fix every remaining hit, or opt it out with a reason (at most 40). Apply 6.9.
2. Write the final worklist: 0 violations, with the opt-outs listed (file, line, reason).
3. Write DESIGN.md:
   - the parity statement, with its source (Pipedrive live app, measured 2026-10-22) and the look-only boundary (no logo, name, icons or fonts);
   - the full tokens table and the type, spacing, radius, shadow and motion values;
   - the components, the opt-out policy, and how to run `check:design` and the design spec.
4. List the upstream changes in UPSTREAM.md by folder, and add a README line.
5. Commit, tick.

**Verify:** `pnpm check:design` → `check-design: 0 violation(s)` and exit 0

**Done when:** `src` is at 0 and the docs exist.

#### Task 3.5 - Phase 3 QA gate

**Goal:** Prove the full restyle.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). No `qa` review at this gate (fast profile). Record the Phase 4 base commit, commit `3.5: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → 0 violations, at most 40 opt-outs
- `pnpm exec playwright test e2e/15-design.spec.ts` (all screens, parity checks on) → passes

**QA focus:** Definition of done items 2 to 8.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit && pnpm check:design` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Hardening and hand-off

#### Task 4.1 - Full e2e and the gallery

**Goal:** Behaviour unchanged (specs `00` to `14`), the design spec green, and the full gallery.

**Files:** e2e specs only where a deliberate layout change moved a locator's text or role (rail labels now in tooltips, title now in the top bar; log each); `PROGRESS.md`

**Steps:**
1. Run `pnpm e2e` (specs `00` to `15`). Fix regressions in the app, never by loosening a behaviour assertion.
2. Confirm the gallery: 26 light screens × 2 widths plus 21 dark app screens at 1440 = 73 files in `e2e/screenshots/design/`.
3. Commit, tick.

**Verify:** `pnpm e2e` → passes; `ls e2e/screenshots/design/*.png | wc -l` → `73`

**Done when:** e2e is green and the gallery is complete.

#### Task 4.2 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `pnpm test:integration` (full).
2. Run `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`. Expect SMOKE PASS with "backup round trip ok (3 deals)", and no `dealflow-smoke` container or volume left.
3. Log both, commit, tick.

**Verify:** `pnpm test:integration` passes and the smoke prints `backup round trip ok (3 deals)` (or SKIPPED with the reason from section 10)

**Done when:** both ran and are logged.

#### Task 4.3 - Independent review with a computed-style critique

**Goal:** One fresh-context review of Part 11, which also critiques the design against the numbers.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is:
   - the full `.dsh/qa.md`;
   - a blank line;
   - `Final review of PLAN-PART11.md. Base commit {Phase 0 base}.`;
   - this added instruction: "Also critique Pipedrive parity: for the board, deal, activities-list, inbox, dashboard and settings-profile screens, read computed styles with Playwright (font sizes and weights, colours, heights, widths, radius, borders, shadows and padding of the rail, top bar, toolbar, buttons, view switcher, chips, table header and rows, board column and card, StageTrack, deal sidebar rows, composer tabs) in light, compare every value with sections 6.4 to 6.8 and the 6.1 table, and list each mismatch as a finding with expected and actual values. Review every `design-ok:` opt-out and flag any without a genuine reason."

   Fallbacks: `qa.sh` with the same request, then an evidenced self-review.
2. Fix every blocker and major, and commit `4.3: QA fixes round {r}`.
   - Re-run the gate commands of Task 3.5.
   - After the last round, re-run `pnpm e2e` (full) and the full integration suite, so the final tree has fresh evidence.
   - At most 3 rounds.
3. Log `- Independent review: subagent (fresh context) round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n} · parity mismatches {m}`.
4. Commit `4.3: Independent review and hardening`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`.

**Done when:** the review ran, blockers and majors are fixed or logged, and the final tree has green evidence.

#### Task 4.4 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.4: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least 16.

**Done when:** every checklist item has a line.

#### Task 4.5 - Final report and completion

**Goal:** Hand the owner a short, truthful report and finish the roadmap.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone). Include:
   - Definition of done items 1 to 10, one line each.
   - The Checklist.
   - Owner actions: numbered, with exact commands. Include rebuilding the dev stack and reviewing the gallery in `e2e/screenshots/design/` side by side with Pipedrive (light 1440 and 375, plus dark).
   - Decisions worth reviewing: `CONTRACT CHANGE:` lines, changed tests, and the opt-out count.
   - Open issues.
   - A "Roadmap complete" note listing anything deferred across all parts that remains open.

   Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.5: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`.

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- New features, routes, data or behaviour.
- Any Pipedrive asset: logo, wordmark, icon SVGs, illustrations, font files or screenshots in the repo (match the look, not the assets).
- Pipedrive features Dealflow does not have (marketplace, campaigns, Insights layout of Pipedrive beyond the spec).
- A marketing site or a logo redesign.
- Animation beyond 6.4's motion rules.
- A user-customisable theme or accent colour.
- Changing email templates (system and notification emails) beyond their colours matching the tokens where they already use inline colours.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and `pnpm dev:up` once; still failing → SKIPPED, finish the non-Docker tasks, `COMPLETE WITH OPEN ISSUES` | "Give Docker Desktop more disk or restart it, then run `pnpm test:integration`, `pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| Subagent tool unavailable | `qa.sh`, then the evidenced self-review including the computed-style comparison | "Run the review yourself in a new harness session with `.dsh/qa.md` and the request from Task 4.3" |
| A screen cannot meet axe AA with a measured token | darken that one token by the smallest step that passes, log `CONTRACT CHANGE:` with both values and ratios | none |
| Pipedrive behaviour differs from Dealflow's (an extra control in a Pipedrive toolbar) | style what Dealflow has; never add the control | none |
| A third-party element (chart library, date picker internals) breaks a `check-design` rule | opt out with a reason (it counts toward the 40) | none |
| More than 40 opt-outs needed | fix the cheapest until at most 40, then log the rest as Open issues | "Review the remaining design exceptions" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty.
2. `pnpm install --frozen-lockfile` exits 0; the only added dependency is `@axe-core/playwright` (dev).
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes (count at least the baseline).
6. `pnpm test:integration` passes on the final tree.
7. `pnpm build` exits 0.
8. `pnpm e2e` passes, specs `00` to `15`, on the final tree.
9. `ls e2e/screenshots/design/*.png | wc -l` is 73, and the Part 1 to 10 screenshots are still present.
10. Smoke printed SMOKE PASS and `backup round trip ok (3 deals)`.
11. `pnpm check:design` prints `0 violation(s)` with at most 40 opt-outs; `DESIGN-WORKLIST.md` lists them.
12. The parity checks in 6.10 pass on all four screens (cite the run), and `DESIGN-WORKLIST.md` shows every 6.1 row closed.
13. Every `src/app/(app)/**/page.tsx` sets the top-bar title (`PageTitle`/`usePageTitle`) or uses `PageToolbar` (or has a `design-ok:` line), as checked by `check-design`.
14. The design spec's axe run reports zero serious or critical violations across all gallery screens (cite the run).
15. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
16. `docs/dealflow/DESIGN.md` exists, and `UPSTREAM.md` lists this part's upstream changes.
17. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.5). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed), and shares the board, deal and activities gallery screenshots (1440 light) for the planner's side-by-side parity review.

## Appendix A - DeepSeek Harness overlays

Create these files exactly if either is missing. `loop.sh` passes the first with `--patch`; `qa.sh` passes both.

File: `.dsh/builder.patch.yml`

```yaml
# Dealflow builder overlay for DeepSeek Harness: dsh --profile dealflow --patch .dsh/builder.patch.yml
# A patch row replaces that row's whole config, so each row restates every field it keeps.

# Model for every agent this run creates. DSH_MODEL / DSH_PROVIDER override the defaults.
# The official DeepSeek provider reads DEEPSEEK_API_KEY from the shell or ~/.dsh/.env.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_MODEL || 'deepseek-flash'

# Keep the code and the plan out of request metadata: no session-log upload.
- id: session-log-deepseek
  config:
    enabled: false

# Shell commands run with the unconfined local executor: pnpm's store, Docker and Playwright write outside
# this folder, and headless dsh has nobody to approve sandbox escalations. File tools stay confined to the
# folder by fs-sandbox (DSH_PERMISSION_MODE=workspace-write), and .dsh/guard.bash vets every command.
- id: bash-sandbox
  disabled: true

# Permission presets bundle a sandbox mode and refuse an unconfined executor. Without them the session uses
# DSH_PERMISSION_MODE for file tools and the default approval policy (ask, which fails closed headless).
- id: permission
  disabled: true

- insert:
    - id: bash-local
      name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 900000
        maxTimeoutMs: 1800000
```

File: `.dsh/qa.patch.yml`

```yaml
# Reviewer overlay, applied after builder.patch.yml by qa.sh. DSH_QA_MODEL lets the checker use another model.
- id: agent-default-model
  config:
    provider: !!js process.env.DSH_QA_PROVIDER || process.env.DSH_PROVIDER || 'deepseek-official'
    model: !!js process.env.DSH_QA_MODEL || process.env.DSH_MODEL || 'deepseek-flash'

# The reviewer goes back to the confined shell: its commands may write only inside this folder.
- id: bash-local
  disabled: true

- id: bash-sandbox
  disabled: false
  config:
    timeoutMs: 900000

- id: permission
  disabled: false
```

## Appendix B - `.dsh/qa.md`

```markdown
# Dealflow QA reviewer

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART11.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

If the request is exactly "Reply exactly: QA READY", reply with the two words QA READY and do nothing else.

Hard rules for you:
- You are read-only. Never create, edit, move or delete files, never commit, reset, checkout, stash or push. Commands that only read or that write build output inside this folder (typecheck, lint, build, unit tests) are fine.
- Never call ask_user_question; nobody will answer.
- Never print the contents of .env.
- Stop any server you start.

Input: "Final review of {plan file}. Base commit {hash}.", "Phase N gate review of {plan file}. Base commit {hash}.", or "Part N audit of {plan file}. Base commit {hash}. Focus: ..." (an audit works through every focus item explicitly and reports each one).

Procedure:
1. Read the named plan's sections 2, 3, 6 and 7 and every task (for a phase review: that phase's tasks). For a later part also read the earlier plans' sections where it references them.
2. Run `git --no-optional-locks diff --stat {hash}..HEAD` and read the changed files that matter.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` and note the exact results (use the Environment commands in PROGRESS.md). Read PROGRESS.md for the e2e, integration and smoke results; check the screenshot files the plan lists exist in e2e/screenshots.
4. For every task: each listed file exists; each step is really implemented, not stubbed or left as a placeholder; section 6 contracts match exactly (paths, routes, status codes, redirects, error IDs, env vars, schema, prompts, test hooks); section 7 conventions hold; the task's "Done when" holds.
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, duplicates respect visibility; the service worker never caches authenticated HTML or API responses, offline data is per user and wiped on sign-out, the VAPID private key never reaches the client; the restyle changes no behaviour or test hook, every visual value matches the plan's measured Pipedrive spec (section 6) through tokens or primitives, no Pipedrive asset is copied, and `check-design` opt-outs carry a genuine reason; no em dashes in new files.
6. Ignore style nits and anything in section 9.

Output exactly one of:

QA RESULT: PASS
(one line per command you ran with its result)

or

QA RESULT: FAIL
1. [blocker|major|minor] file:line or route | what is wrong | what the plan requires (section/task) | how to fix
(at most 25 items, blockers first)
```

## Appendix C - `qa.sh`

```bash
#!/usr/bin/env bash
# Independent QA: a separate DeepSeek Harness process (fresh context) with the reviewer instructions in .dsh/qa.md.
# Usage: ./qa.sh "Final review of PLAN-PART11.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
set -u
cd "$(dirname "$0")"
REQUEST="${1:?pass the review request}"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "QA RUNNER ERROR: dsh not found (npm install -g @deepseek-ai/dsh)"; exit 2; }
# The reviewer runs the confined shell (qa.patch.yml) and file tools limited to this folder.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
BEFORE="$(git --no-optional-locks status --porcelain 2>/dev/null)"
PROMPT="$(cat .dsh/qa.md)

$REQUEST"
OUT="$(dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml "$PROMPT" 2>/dev/null)"
CODE=$?
AFTER="$(git --no-optional-locks status --porcelain 2>/dev/null)"
printf '%s\n' "$OUT"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "QA WARNING: the working tree changed during the review; restore those files with git checkout -- <file>"
fi
if printf '%s' "$OUT" | grep -qE "QA RESULT:|QA READY"; then exit 0; fi
echo "QA RUNNER ERROR: no QA RESULT in the output (dsh exit $CODE)"
exit 1
```

## Appendix D - `scripts/check-progress.mjs`

```js
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
```

## Appendix E - command guard

File: `.dsh/guard.bash`

```bash
# Sourced by every non-interactive `bash -c` the agent runs (BASH_ENV is exported by loop.sh and qa.sh).
# It hands the command string to guard.mjs before bash runs it; a blocked command exits 126 with the reason.
if [ -n "${BASH_EXECUTION_STRING:-}" ] && [ -n "${DEALFLOW_PROJECT_DIR:-}" ]; then
  if ! printf '%s' "$BASH_EXECUTION_STRING" | node "$DEALFLOW_PROJECT_DIR/.dsh/guard.mjs"; then
    exit 126
  fi
fi
```

File: `.dsh/guard.mjs`

```js
#!/usr/bin/env node
// Command guard for the Dealflow build. .dsh/guard.bash pipes each `bash -c` command string here.
// Shell commands run unconfined (pnpm, Docker and Playwright write outside the folder), so this blocks the
// commands the plan forbids. Exit 2 with a reason on stderr blocks; exit 0 allows.
import { readFileSync } from "node:fs";

let cmd = "";
try {
  cmd = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const block = (why) => {
  process.stderr.write(`blocked by Dealflow guard: ${why}. This is a hard limit in the plan; log it and continue.\n`);
  process.exit(2);
};
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART(?:1[01]|[1-9])\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
const DENY = [
  [/\/Users\/[^/\s]+\/Downloads\/DEALFLOW(\/|\s|$|["'])|\.\.\/DEALFLOW(\/|\s|$)/, "the old Dealflow app folder is off limits"],
  [/\bgit\s+push\b/, "git push"],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
  [/\bgit\s+clean\b/, "git clean"],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, "history rewrite"],
  [/\bgit\s+branch\s+-D\b/, "deleting a branch"],
  [/\bgit\s+(checkout|restore)\s+(--\S*\s+)*\.(\s|$)/, "discarding all changes"],
  [/(^|[\s;&|(])sudo\s/, "sudo"],
  [/\brm\s+(-\S+\s+)*\S*\.git(\s|\/|$)/, "deleting git data"],
  [/\bdocker\s+(system|volume|image|container|builder|network)\s+prune\b/, "docker prune"],
  [/\bdocker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)/, "compose down with volumes"],
  [/\bdocker\s+volume\s+rm\b(?!(\s+dealflow-smoke_[a-z]+)+\s*$)/, "removing a volume other than dealflow-smoke_*"],
  [/\bdocker\s+(rm|rmi|kill|stop)\b(?!.*dealflow-smoke)/, "removing or stopping containers outside dealflow-smoke"],
  [/\b(npm|pnpm|yarn)\s+publish\b/, "publishing a package"],
  [/\bcurl\b[^|]*\|\s*(ba|z)?sh\b/, "piping a download into a shell"],
  [/DROP\s+DATABASE\s+(?!(IF\s+EXISTS\s+)?"?dealflow_e2e\b)/i, "dropping a database other than dealflow_e2e"],
  [/(^|[\s;&|])(cat|less|more|head|tail|bat|nl|strings|xxd|grep)\s+(\S+\s+)*(\S*\/)?\.env(\s|$)/, "printing .env"],
  [/>>?\s*\.env(\s|$)/, "writing .env directly (use scripts/dealflow/env-sync.mjs)"],
  [/\b(sed|perl)\s+-i\b.*(\s|\/)\.env(\s|$)/, "editing .env directly"],
  [/:3333\b/, "port 3333 belongs to the owner's old app"],
];
for (const [re, why] of DENY) if (re.test(cmd)) block(why);
// rm may only touch paths inside the project, /tmp or /private/tmp.
const project = process.env.DEALFLOW_PROJECT_DIR || process.cwd();
for (const m of cmd.matchAll(/\brm\s+([^;&|\n]*)/g)) {
  for (const arg of m[1].split(/\s+/).filter((a) => a !== "" && !a.startsWith("-"))) {
    const target = arg.replace(/^["']|["']$/g, "");
    if (/^(~|\$HOME|\.\.)/.test(target) || target === "/" || target === "*" || target === "/*") block("deleting outside the project");
    if (target.startsWith("/") && !["/tmp/", "/private/tmp/", `${project}/`].some((ok) => target.startsWith(ok))) {
      block("deleting outside the project");
    }
  }
}
const KIT_WRITES = [
  new RegExp(String.raw`(^|[^0-9&])>>?\s*` + KIT),
  new RegExp(String.raw`\b(rm|mv|truncate|tee)\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\b(sed|perl)\s+-i\b[^;&|]*\s` + KIT),
  new RegExp(String.raw`\bcp\b[^;&|]*\s` + KIT + String.raw`\s*($|[;&|])`),
];
if (KIT_WRITES.some((re) => re.test(cmd))) block("changing a kit file");
process.exit(0);
```

## Appendix F - `loop.sh`

```bash
#!/usr/bin/env bash
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART11.md (dealflow-wd-p11-v1) is finished.
# Usage: ./loop.sh      Env: DSH_MODEL (default deepseek-flash), MAX_RUNS (30), RUN_TIMEOUT_MIN (240), DSH_PROFILE (dealflow)
set -u
cd "$(dirname "$0")"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh, then ./dsh-setup.sh"; exit 2; }
MAX_RUNS="${MAX_RUNS:-30}"
RUN_TIMEOUT_MIN="${RUN_TIMEOUT_MIN:-240}"
PROFILE="${DSH_PROFILE:-dealflow}"
# File tools stay inside this folder (workspace-write). Shell commands run unconfined through bash-local and
# every one passes .dsh/guard.bash first. Headless dsh has nobody to answer approvals, so they fail closed.
export DSH_PERMISSION_MODE=workspace-write DSH_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
export BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD"
unset DSH_TOOLS_MODE
PROMPT='Read PLAN-PART11.md in this folder in full and PROGRESS.md, then follow PLAN-PART11.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p11-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p11-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p11-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
digest() { if [ -f PROGRESS.md ]; then shasum PROGRESS.md | cut -d' ' -f1; else echo none; fi; }
mkdir -p .dsh/logs
STALLED=0
for i in $(seq 1 "$MAX_RUNS"); do
  if finished; then echo "Finished: $(grep -m1 -E '^STATUS:' PROGRESS.md)"; exit 0; fi
  LOG=".dsh/logs/run-$(printf '%02d' "$i")-$(date +%Y%m%d-%H%M%S).log"
  BEFORE="$(digest)"
  echo "=== builder run $i/$MAX_RUNS ($(date)) log: $LOG"
  dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml "$PROMPT" >"$LOG" 2>&1 &
  PID=$!
  ( sleep $((RUN_TIMEOUT_MIN * 60)); kill -TERM "$PID" 2>/dev/null ) &
  WATCHDOG=$!
  wait "$PID"; CODE=$?
  kill "$WATCHDOG" 2>/dev/null; wait "$WATCHDOG" 2>/dev/null
  echo "run $i exited with $CODE; $(grep -m1 -E '^Current:' PROGRESS.md 2>/dev/null)"
  if grep -q "MISSING_CREDENTIAL" "$LOG"; then echo "Stopped: no DeepSeek API key. Put DEEPSEEK_API_KEY in ~/.dsh/.env and rerun."; exit 2; fi
  if [ "$(digest)" = "$BEFORE" ]; then STALLED=$((STALLED + 1)); else STALLED=0; fi
  if [ "$STALLED" -ge 3 ]; then echo "Stopped: PROGRESS.md unchanged for 3 runs. Read the last log in .dsh/logs/."; exit 1; fi
done
echo "Stopped after $MAX_RUNS runs without STATUS: COMPLETE. Check PROGRESS.md."
exit 1
```

## Appendix G - `dsh-setup.sh`

```bash
#!/usr/bin/env bash
# One-time setup of the DeepSeek Harness profile used by loop.sh and qa.sh. Safe to re-run (it rebuilds the profile).
set -u
cd "$(dirname "$0")"
PROFILE="${DSH_PROFILE:-dealflow}"
command -v dsh >/dev/null 2>&1 || { echo "dsh not found: npm install -g @deepseek-ai/dsh"; exit 2; }
echo "dsh $(dsh --version)"
dsh --profile "$PROFILE" --from-default-profile headless --help >/dev/null || { echo "could not create the $PROFILE profile from the headless template"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --dump-config >/dev/null || { echo "builder overlay does not load"; exit 1; }
dsh --profile "$PROFILE" --patch .dsh/builder.patch.yml --patch .dsh/qa.patch.yml --dump-config >/dev/null || { echo "qa overlay does not load"; exit 1; }
echo "profile $PROFILE: ok"
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'git push origin main' >/dev/null 2>&1
if [ $? -eq 126 ]; then echo "guard self-test (blocks git push): ok"; else echo "guard self-test: FAILED, do not run loop.sh"; exit 1; fi
BASH_ENV="$PWD/.dsh/guard.bash" DEALFLOW_PROJECT_DIR="$PWD" bash -c 'true' || { echo "guard self-test (allows true): FAILED"; exit 1; }
if [ -z "${DEEPSEEK_API_KEY:-}" ] && ! grep -q "^DEEPSEEK_API_KEY=" "${DSH_HOME:-$HOME/.dsh}/.env" 2>/dev/null; then
  echo "note: put DEEPSEEK_API_KEY=... in ${DSH_HOME:-$HOME/.dsh}/.env (keep it out of this project's .env)"
fi
echo "Next: ./qa.sh \"Reply exactly: QA READY\"  then  ./loop.sh"
```

## Appendix H - `AGENTS.md`

```markdown
# Agent notes for this repository

This folder is warpdrive, being extended into Dealflow by an autonomous build.

- If your task prompt names you the QA reviewer, follow `.dsh/qa.md` and ignore the rest of this file.
- Otherwise you are the builder: read `PLAN-PART11.md` in full (Parts 1 to 10 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART11.md rule 18.
```
