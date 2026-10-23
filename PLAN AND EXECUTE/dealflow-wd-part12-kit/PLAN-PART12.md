# PLAN: Dealflow on warpdrive, Part 12: Professional UI polish (30 improvements)

> Plan ID: dealflow-wd-p12-v1 · Written: 2026-10-23 (owner request after using the app; planner review of all 73 gallery screens and the code) · Planner: Claude (planforexec) · Builder: DeepSeek V4.1 Flash (1017) in DeepSeek Harness (`dsh`) · Run mode: one autonomous run, Phases 0 to 4, fast verification profile, no human in the loop · Type: change to existing project

Parts 1 to 11 are finished (`PROGRESS-P1.md` to `PROGRESS-P10.md`, and `PROGRESS.md` until Task 0.1 renames it to `PROGRESS-P11.md`). After Part 11 the owner added the brand rollout (`brand: 1..8`), a user guide with PDFs (`docs/user-guide`) and a static website (`website/`). Part 12 fixes 30 professional-polish issues: dialog anatomy, scrolling lists, an expandable rail, hidden install and offline UI, the Add deal dialog, AI draft reliability and 24 screen-level refinements. It is proven by `check-design`, a new polish e2e spec and the gallery. Where it says "find", locate the existing component and change it; log a file as a Decision only when it is surprising.

## 0. Rules for the builder: autonomous loop (fast profile)

You are the builder. A stronger model wrote this plan after deciding everything that matters; its decisions are final. You will build **Phases 0 to 4** in fresh-context sessions, one phase per session. Parts 1 to 11 (`PLAN-PART1.md` to `PLAN-PART11.md`) are finished; their code is the base you extend. Where the code differs from what this plan describes, the code is the source of truth for existing behaviour, and new work stays consistent with it. Nobody is watching and nobody will answer questions. Give it your best complete shot; the owner reads PROGRESS.md when you finish.

```
resume from PROGRESS.md
  └─ for each unchecked task in order: build → typecheck → commit → tick
       └─ end of phase: gate task = typecheck + lint + build + unit tests (+ named integration files) green → log → end session
            └─ last phase: e2e + screenshots, integration suite, smoke, ONE independent review, checklist, report
                 └─ STATUS: COMPLETE → end the session
```

**The loop**
1. On start, and again after any interruption, crash or context compaction, read `PLAN-PART12.md` in full and PROGRESS.md (open earlier `PLAN-PART{N}.md` files only where this plan points to them). If PROGRESS.md's title line is not `# PROGRESS: dealflow-wd-p12-v1`, you are starting fresh at Task 0.1 (PROGRESS.md is still Part 11's finished file). Otherwise the first unchecked line in PROGRESS.md → Tasks is your next work. Never redo checked work unless a gate shows it is broken.
2. Work tasks strictly in order. Names, paths, numbers, versions and contracts in this plan are requirements, not suggestions.
3. **Session rhythm.** Inside a phase, do not stop between tasks: don't summarise and wait, don't ask "shall I continue?". When a phase's gate task is done (ticked, committed, logged), **end the session** with `STATUS: IN PROGRESS` and `Current:` set to the next task. Also end the session early, the same way, if your context is getting long: finish and commit the current task first. The only valid final states are `STATUS: COMPLETE` (Task 4.6, after `pnpm check:progress --final` passes), `STATUS: COMPLETE WITH OPEN ISSUES` (same check passes, some Definition-of-done items FAIL) or `STATUS: BLOCKED` (fatal cases in section 4 only).
4. **Never ask the owner anything.** Nobody can answer in this run, so never call `ask_user_question` and never wait for approval. Use the decision policy below.

**Decision policy: decide, log, continue**
5. If the plan is ambiguous or contradicts itself, or reality differs from it (a library API changed, a command behaves differently, an existing file looks different): choose the option that best matches the plan's intent and mainstream best practice, implement it, and add one line to PROGRESS.md → Decisions: `{task id}: chose X over Y because Z`. Continue.
6. If something can only come from the owner (a key, a password, a taste judgement, an account, money, a missing tool): use the safe default in section 10, add `TODO(owner): {exact action}` to PROGRESS.md → Owner actions, and continue.
7. Don't add scope (section 9). Glue the plan clearly implies (an import, a helper, a type, a missing `data-testid`) is not scope; just do it.

**Verification cadence: fast profile**
8. Per task: implement it fully, run `pnpm typecheck` once at the end (fix errors; no more than 2 attempts), commit, tick. Run a task's **Verify** line only if it takes under about 3 minutes and needs no browser. Tasks that write risky-logic tests name the exact test files to run, and you run exactly those. Never run the whole integration suite outside Task 4.3.
9. Each phase except the last ends with a **gate task** (titled "Phase N QA gate": 0.3, 1.7, 2.6, 3.8):
   1. Run the gate commands. Fix until green: up to 5 fix rounds; if still red, re-read section 6 and the failing task and try a different approach for up to 3 more rounds.
   2. Run `pnpm check:progress` and fix what it reports.
   3. Log one line in PROGRESS.md → QA log: `- Phase N gate: commands green|red · typecheck {result} · lint {result} · build {result} · unit {passed}/{total} · {named integration files} {passed}/{total}`. Leftovers go to Open issues with the exact error and what you tried. **Then end the session (rule 3); never end the run on a red gate.**
   4. No independent review at phase gates (fast profile). The one independent review is Task 4.4.
10. **Ticks must be true.** Tick a task only after its own commit `{task id}: {task title}` exists (one task per commit; combined commits like `2.1-2.4:` are not allowed). `pnpm check:progress` verifies this. A task you could not finish stays unticked with an Open issue. Never fake a pass. Never delete, skip (`.skip`, `.only`), loosen or comment out a test or check to turn it green; never tick something you didn't actually run. When this plan deliberately changes behaviour, names or signatures (dialog anatomy, the expandable rail, the hidden install and offline UI, controls moved into popovers or menus, style-guard allow-lists), updating the affected tests to the new contract is required work: change names and wiring, never weaken an assertion, and log one Decision per group of tests. Never raise a rate limit or weaken a security rule to make a test pass.
11. Stuck rule: if the same error comes back 3 times after the same kind of fix, stop that approach, log it in Open issues and move to the next task.

**Hard limits: never do these; log `TODO(owner)` instead**
12. Never write a real secret anywhere (keys, real passwords, mailbox credentials). Only env var names and `.env.example` placeholders. Test fixtures use obviously fake values. Never print the values of `.env`.
13. Never push, publish, deploy, create accounts or spend money. Never force-push or rewrite pushed history. Never call paid services: AI checks use `AI_FAKE=true` or the scripted provider. Allowed real-network calls: package installs only. This part needs no external service; e2e uses the fake mail transport and the fake AI provider.
14. Never read, write or run anything in `/Users/cxt22/Downloads/DEALFLOW` or in the `DEALFLOW/` folder inside this workspace (old app copies, excluded from git and every tool). Never delete anything outside this project folder. Never stop, remove, recreate or call the owner's live Compose project `dealflow-prod` (127.0.0.1:3001, 8080 and 9000) and never read `.env.production`. Never stop, remove or recreate the owner's Compose project `warpdrive-main` (only `up -d` of its postgres, minio and createbuckets with the section 4 ports is allowed), never prune Docker, never run `docker compose down -v`. Allowed throwaway resources: Compose project `dealflow-smoke` (containers, images `dealflow-smoke-*`, volumes `dealflow-smoke_pgdata`, `dealflow-smoke_miniodata`), the Postgres database `dealflow_e2e` inside the dev Postgres, Testcontainers containers, and the folders `.e2e/`, `.smoke/`, `.mail-capture/`, `e2e/screenshots/`, `test-results/`, `playwright-report/`.
15. Never change the stack (section 3). Never change a contract (section 6) for convenience; if one genuinely cannot work, make the smallest change that does and log it under Decisions starting with `CONTRACT CHANGE:`.
16. Never run a server in the foreground. Dev servers, built servers, workers and containers run in the background and are stopped when the check is done. Playwright starts and stops its own server. Ports: e2e 3210/3211, container smoke 3310/3311/3312 (or the next free trio from 3320), dev stack Postgres 5433 and MinIO 9100/9101 (section 4); 3001, 8080 and 9000 belong to `dealflow-prod`: never bind or call them. Never touch port 3333 or 3000.
17. Never overwrite or reformat `.env`. Only `scripts/dealflow/env-sync.mjs` may change it, and only by appending missing keys.
18. Never edit the kit: `AGENTS.md`, `.dsh/`, `loop.sh`, `qa.sh`, `dsh-setup.sh`, `scripts/check-progress.mjs`, `PLAN-PART1.md`, `PLAN-PART2.md`, `PLAN-PART3.md`, `PLAN-PART4.md`, `PLAN-PART5.md`, `PLAN-PART6.md`, `PLAN-PART7.md`, `PLAN-PART8.md`, `PLAN-PART9.md`, `PLAN-PART10.md`, `PLAN-PART11.md`, `PLAN-PART12.md`, `ROADMAP.md`, `AMENDMENTS-P1-1.md`. A missing kit file is recreated from the appendices, nothing else.

**Git**
19. Before each phase's first task, record `git rev-parse HEAD` in PROGRESS.md → Phase base commits (Task 0.1 records Phase 0's base). Commit after every task (`{task id}: {task title}`) and after every gate fix round (`{gate id}: fixes round {r}`). Use `git --no-optional-locks` for read-only git commands.

**PROGRESS.md format** (Task 0.1 renames Part 11's file to `PROGRESS-P11.md` and creates this one with every task listed, all unchecked)

```markdown
# PROGRESS: dealflow-wd-p12-v1

STATUS: IN PROGRESS
Current: 0.1 · Last updated: {date time}

## Phase base commits
- Phase 0: {hash}

## Tasks
- [ ] 0.1 Start Part 12: progress files, kit, baseline and environment
(every task through 4.6, titles exactly as in section 8)

## QA log
- Phase 0 gate: commands green · typecheck ok · lint ok · build ok · unit 5480/5480 · check:design new rules 41

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

Make Dealflow feel like a finished, professional SaaS product. Part 11 matched Pipedrive's tokens; the owner then used the app and the planner reviewed all 73 gallery screens plus the code, and found layout bugs, inconsistent anatomy and rough edges. This part fixes the **30 improvements in 6.1** (the first seven are the owner's own reports):

- the clipped dialog title and the close button sitting on the header rule;
- long select lists that cannot scroll;
- an icon-only rail that should expand with labels;
- mobile, install, offline and push wording to hide (not remove);
- the Add deal dialog;
- the AI email draft that fails with "The AI reply could not be understood".

Everything is restyle, layout or reliability work on existing features. No new data, routes or business behaviour, except the rail's expanded state (a UI preference) and the hidden-UI switch.

## 2. Definition of done

1. Every row U1 to U30 in 6.1 is implemented as its contract in 6.2 to 6.9 says, and `docs/dealflow/POLISH.md` lists each row with the task and commit that closed it.
2. Dialogs (U1): every `DialogContent` in `src` uses the 6.2 anatomy. `pnpm check:design` reports 0 violations including the two new rules in 6.10, with at most 15 opt-outs added in this part (Part 11's opt-outs stay).
3. Long lists (U2, U3): every Select scrolls inside the viewport, and currency and time zone pickers are searchable comboboxes.
4. The rail (U4) expands to labels and collapses to icons, remembers the choice, and defaults to expanded.
5. The hidden UI (U5) is off by default behind `NEXT_PUBLIC_PWA_UI`. With it on (the e2e build), spec `14-pwa-mobile` still passes unchanged in behaviour.
6. AI JSON features (U7) survive prose-wrapped, fenced and reasoning-truncated replies (unit tests in 6.9), and show a humane error with a retry button.
7. `e2e/16-polish.spec.ts` (6.11) passes. Specs `00` to `15` pass, with Part 11's spec updated only where 6.1 changes a contract (each change logged).
8. The design gallery is regenerated: 73 files plus the 10 polish screens in 6.11, and `docs/user-guide` is updated for the rail and the hidden UI, with the PDFs rebuilt.
9. typecheck, lint, build, unit and the full integration suite pass, smoke passes, and one independent review ran.

## 3. Decisions already made

- **Scope.** The 30 rows in 6.1, nothing else (section 9). The planner chose them from a full review on 2026-10-23.
- **Part 11 contracts that change (all are owner decisions, log each test update as a Decision):**
  - The rail: 56 px icon-only becomes expandable, 232 px with labels by default (6.4).
  - The board column header grows from 64 to 72 px to show three lines without truncation (6.7.2).
  - Dialog anatomy (6.2) replaces the negative-margin header.
- **Hidden, not removed (U5).** The service worker, the offline store, the `/offline` page, push delivery and all their code and tests stay. Only the user-facing mentions are hidden by one flag. The mobile bottom navigation is layout, not a mention, and stays.
- **No new dependencies.** Everything uses the installed Radix, shadcn wrappers, lucide icons, `cmdk` (already behind `Combobox`) and Intl.
- **AI reliability (U7)** is fixed in the shared `chatJson` and the OpenRouter provider, so every JSON feature benefits (email draft, notes to activities, AI filters, automation drafting, report explain, deal summary and score).
- **Dark mode** must look as intentional as light for every touched screen. The owner uses dark mode daily; the gallery's dark screens are reviewed this time, not just sanity-checked.
- **Mobile.** Keep Part 10 and 11 behaviour at 375 px, with no new mobile work. The no-horizontal-scroll check at 375 px must keep passing.

## 4. Assumptions to verify

| Check | Expected | If not |
|---|---|---|
| Starting point | PROGRESS.md says `dealflow-wd-p11-v1` and `STATUS: COMPLETE`; the commits after it are `brand: 1..8`, `app: Docs button ...`, `docs: ...` and `website: ...` | log a Decision describing what you found; continue |
| The owner's live stack | `docker compose ls` shows `dealflow-prod` running, publishing 127.0.0.1:3001, 8080 and 9000 | nothing to do; never touch it either way |
| Dev stack ports | MinIO 9000 is taken by `dealflow-prod`, so the dev stack runs MinIO on 9100 (console 9101) and Postgres on 5433: `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up` | if 5433 or 9100 is also taken, use the next free port in steps of 10 and log it; record the exact command in Environment |
| e2e and MinIO | `scripts/e2e/e2e-env.mjs` reads `MINIO_PORT` and `DEV_PG_PORT` from the shell | always run e2e as `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (and record it) |
| Docker | `docker info` answers, and the VM has at least 10 GB free | recover once (`open -a Docker`, then the dev:up command above); if it still fails, it is fatal: `STATUS: BLOCKED` with an Owner action |
| Kit location | `PLAN-PART12.md` and the kit at the repo root, or in `PLAN AND EXECUTE/dealflow-wd-part12-kit/` | root symlink plus the byte-identical checker copy; log a Decision |
| `site/` and `website/` | `site/` is the untouched upstream landing page, and `website/` is the Dealflow site source | never edit `site/`; this part does not touch `website/` either (the live site is a separate repo now) |
| Combobox | `src/components/ui/Combobox.tsx` wraps `cmdk` in a Popover with search | if it lacks a max height or keyboard search, add them in Task 1.2 |
| pnpm 9, subagent, Playwright browsers | as in Part 11 (PROGRESS-P11 Environment) | as in Part 11 |

**Known environment:** after Task 0.1 renames it, copy `PROGRESS-P11.md` → Environment into PROGRESS.md → Environment, replace the dev-stack and e2e lines with the 9100 commands above, and follow it.

**Fatal (STOP with `STATUS: BLOCKED`):** pnpm cannot be installed; `pnpm install` fails for a registry reason; Docker is down at Task 0.1 (above).

## 5. Target structure

```
src/components/ui/dialog.tsx, alert-dialog.tsx, sheet.tsx    # 6.2 anatomy: header with close, body, footer
src/components/ui/Select.tsx, Combobox.tsx                   # 6.3 scrolling lists, searchable long lists
src/components/ui/form-field.tsx                             # 6.3 FormField + FormGrid (new)
src/components/ui/table-styles.ts, EmptyState.tsx            # 6.8 table footer, empty cells, empty states
src/lib/format/number.ts                                     # 6.5 formatMoney, formatMoneyCompact, formatNumber (new)
src/components/shell/LeftNav.tsx, railState.ts, RailToggle.tsx  # 6.4 expandable rail (railState/RailToggle new)
src/config/clientEnv.ts, src/constants/pwa.ts                # 6.4 NEXT_PUBLIC_PWA_UI flag
src/features/ai/chatJson.ts, openrouterProvider.ts, extractJson.ts  # 6.9 (extractJson new)
scripts/dealflow/check-design.mjs                            # 6.10 two new rules
e2e/16-polish.spec.ts, e2e/polish/{checks.ts,routes.ts}      # 6.11 (new)
docs/dealflow/POLISH.md                                      # U1 to U30 with task and commit
```

## 6. Contracts

### 6.1 The 30 improvements

Every row is closed by the task named. "Owner" marks the owner's own reports.

| ID | Where | Problem found | Fix (contract) | Task |
|---|---|---|---|---|
| U1 | All dialogs (Owner) | `DialogHeader` uses `-mx-6 -mt-6` while dialogs like `EntityCreateDialogShell` set `p-0`, so the title is pushed 24 px above the box and clipped ("Add deal" cut off). The close button is absolutely placed at `top-4` and lands on the header rule. | 6.2 anatomy | 1.1 |
| U2 | Every Select (Owner: currencies) | `Select` content is `position="popper"` with `overflow-hidden` and no max height, so long lists run off screen and cannot scroll | 6.3 Select | 1.2 |
| U3 | Currency and time zone pickers | 160 currencies and 400+ zones in a plain list | searchable `Combobox` (6.3) | 1.2 |
| U4 | Rail (Owner) | Icons only, with no way to see labels | expandable rail, 6.4 | 2.1 |
| U5 | Install, offline, push (Owner) | The owner does not use install, offline or push, and wants every mention hidden | `NEXT_PUBLIC_PWA_UI` flag, 6.4 | 2.2 |
| U6 | Add deal dialog (Owner) | Stage chevrons truncate to "Qual…", "Cont…"; the right "Person" column is unbalanced; the currency and owner pickers use different chevrons | 6.7.1 | 3.1 |
| U7 | AI drafts (Owner) | "The AI reply could not be understood". Reasoning models spend the 800-token budget thinking (empty or cut content), and the fence regex only accepts a whole-string fence | 6.9 | 1.6 |
| U8 | Forms everywhere | Label sizes, gaps and widths differ per dialog and settings page | `FormField` + `FormGrid` (6.3) | 1.3 |
| U9 | Selects and comboboxes | `Select` uses `ChevronDown` while Combobox (Owner field) uses up/down chevrons, and heights differ | one trigger style (6.3) | 1.2 |
| U10 | Money and numbers | Chart axes show `$380,000.00`; products show `1200.00 USD`; org revenue shows `18500000.00` | 6.5 helpers everywhere | 1.4 |
| U11 | Index pages | Documents, Insights and Projects repeat the top-bar title as a large H1 | 6.6 heading rule | 2.3 |
| U12 | Settings | Content is capped near 520 to 700 px in a 1440 window; the nav is a long unscrolled list; pages must always scroll | 6.6 settings layout | 2.3 |
| U13 | Contacts | People, Organizations and Timeline sit in a 180 px left panel on every list and record | view switcher in the toolbar (6.6) | 2.4 |
| U14 | Toolbars | Activities puts Export CSV on its own row; Projects uses full-width selects; the control order differs per page | 6.6 toolbar order | 2.5 |
| U15 | AI filter box | "Describe a filter" is a tall card wedged into the toolbar, and its placeholder talks about deals on Leads, People and Organizations | "Ask AI" popover, entity placeholders (6.6) | 2.5 |
| U16 | Board column header | "W. 1 excluded" and "Weighted $8…" truncate | 72 px, three lines (6.7.2) | 3.2 |
| U17 | Board cards | Solid green "AI 72" pills shout on every card | calm score pill (6.7.2) | 3.2 |
| U18 | Forecast | Total, Weighted and Won values overlap in each month header | stacked grid (6.7.3) | 3.3 |
| U19 | Calendar | The day starts at 00:00, so working hours are below the fold; the grid is flat | 6.7.3 | 3.3 |
| U20 | Deal stage track | Every future stage says "0 days" | 6.7.4 | 3.4 |
| U21 | Document editor | The raw template (`# Quote {{document.number}}`) is the main field; actions mix filled, outline and plain text; "Send" looks disabled | 6.7.5 | 3.5 |
| U22 | Email thread | White message boxes in dark mode, a narrow centred column, an unlabeled follow-up select | 6.7.6 | 3.6 |
| U23 | Inbox list | Sender, subject and snippet run together | grid row (6.7.6) | 3.6 |
| U24 | Leads list | An orange "No activity" warning on every row; source values like "manually created" | 6.7.7 | 3.7 |
| U25 | Dashboard | The dashboard name is a form input at the top; actions are scattered | 6.7.7 | 3.7 |
| U26 | Insights index | A bare two-line list under a duplicate H1 | table plus empty state (6.7.7) | 3.7 |
| U27 | Person and organization | The follower count wraps under "0 followers"; detail labels are right-aligned; numbers are raw | 6.7.4 | 3.4 |
| U28 | Projects | Full-width filter selects; "Start date" label with "Start date" placeholder | 6.7.7 | 3.7 |
| U29 | Tables | "Showing 50 of 107" floats top-left; empty cells mix "-" and blanks; headers do not stick | 6.8 | 1.5 |
| U30 | Empty states and top bar | Empty pages show bare text; the bell badge shows "16" at full width | 6.8 | 1.5 |

### 6.2 Dialog anatomy (U1)

Applies to `dialog.tsx`, `alert-dialog.tsx` and `sheet.tsx`, and to every usage (52 files contain `DialogContent`; find them with `grep -rl DialogContent src`).

- **`DialogContent`**: `flex flex-col gap-0 p-0 overflow-hidden max-h-[calc(100dvh-48px)]`, keeping the existing width sizes (`sm` 480, `md` 600, `lg` 800), radius, border, shadow and animation. It no longer renders a close button by default. New prop `closeButton?: "header" | "corner" | "none"` (default `"header"`):
  - `"header"`: the close button is rendered by `DialogHeader` (below).
  - `"corner"`: an absolutely placed button at `top-3 right-3`, for dialogs with no header (the command palette, image previews).
  - `"none"`: no close button, for flows that must not be dismissed this way.
- **`DialogHeader`**: `flex shrink-0 items-center justify-between gap-4 min-h-14 px-6 py-3 border-b`. No negative margins. Its children (title and optional description) go in a `min-w-0 flex-1` column; the title truncates with `truncate` and a `title` attribute. The close button is the last child: `size-8 shrink-0 -mr-2 rounded-md`, the same X icon, `aria-label="Close"`, `data-testid="dialog-close"`, and the same telemetry handler (`setLastCloseReason("user")`). It is vertically centred with the title, so it can never touch the border.
- **`DialogBody`** (new export): `flex-1 min-h-0 overflow-y-auto px-6 py-5`. All scrolling happens here; the header and footer never scroll away.
- **`DialogFooter`**: `flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4`. No negative margins. An optional left slot (`DialogFooter` child with `data-slot="start"`) carries secondary text or a destructive link, pushed left with `mr-auto`.
- **`AlertDialog`**: the same header, body and footer paddings, and `closeButton` defaults to `"none"`.
- **`Sheet`**: the same header rule (a flex row with the close button inside it), plus `SheetBody` with the same padding and scrolling.
- **Migration:** every usage moves its fields into `DialogBody`. Remove per-usage overrides of header or footer padding, `p-0` and negative margins. `EntityCreateDialogShell` becomes header, body (`bodyClassName` still applies) and footer on top of these parts.
- **Tests:** keep every existing hook. `dialog.test.tsx` gains:
  - the header contains the close button;
  - `DialogBody` is the only scroll container;
  - `closeButton="corner"` and `"none"` behave as described.

### 6.3 Lists, pickers and fields (U2, U3, U8, U9)

**Select:**
- `Content` gets `max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)]`.
- `Viewport` gets `max-h-[inherit] overflow-y-auto` and keeps `p-1`.
- Add `RadixSelect.ScrollUpButton` and `ScrollDownButton`: 24 px rows with a chevron icon, centred, muted.
- Keyboard type-ahead stays (Radix default).
- Unit test: rendering 200 options gives a viewport whose computed `max-height` is not `none`.

**Combobox:**
- The list has a `max-h-80 overflow-y-auto` viewport, a search input with placeholder "Search…" and an empty row "No results".
- The trigger matches the Select trigger exactly: same height, padding, border, radius, `ChevronDown h-4 w-4 text-muted-foreground`, and the same open rotation. Replace any up/down chevron icon in comboboxes.
- Rule: a picker with more than 12 options uses `Combobox`. Apply it to:
  - base currency and rate currency (`CurrenciesSettings.tsx`);
  - the deal currency (Add deal, deal edit, product currency);
  - time zone (profile, booking pages);
  - any other list over 12 options found with `grep -rn "<Select" src`. Log each.

**FormField and FormGrid** (new `src/components/ui/form-field.tsx`):

```tsx
export function FormField(props: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode; required?: boolean; className?: string; children: ReactNode }): ReactNode
// grid gap-1.5; label: text-sm font-medium text-foreground (required adds a muted "*" with aria-hidden and the input gets aria-required);
// hint: text-meta text-muted-foreground; error: text-meta text-destructive with role="alert"; error wins over hint.
export function FormGrid(props: { columns?: 1 | 2; className?: string; children: ReactNode }): ReactNode
// grid gap-4; columns 2 = sm:grid-cols-2 gap-x-4; a child with data-span="full" spans both columns.
```

Apply to:
- every create dialog (deal, person, organization, lead, activity, product, project, booking page, form, webhook, API token, invite);
- the settings forms on Profile, Company, Documents, Currencies, Goals and AI.

Keep every `id`, label text and `data-testid`. Existing label elements become `FormField` labels with the same text, so `getByLabel` selectors keep working.

### 6.4 Rail and hidden UI (U4, U5)

**Expandable rail** (`LeftNav.tsx`, new `railState.ts` and `RailToggle.tsx`), desktop (768 px and wider) only:
- **State:** `"expanded" | "collapsed"`, stored in the cookie `wd_rail` (path `/`, one year, SameSite Lax). The root app layout reads it on the server, so the first paint has the right width (no layout shift). The default when the cookie is absent is `"expanded"`. The `[` key toggles it (add it to the shortcut registry, Navigation group, label "Toggle sidebar"; ignored while typing in a field).
- **Widths:** collapsed 56 px (Part 11, unchanged); expanded 232 px. The width animates over 200 ms ease-out, or not at all under `prefers-reduced-motion`. The content area resizes; nothing overlaps.
- **Brand cell:** 56 px tall. Collapsed: the reverse mark at 28 px (brand rollout). Expanded: `public/brand/dealflow-logo-horizontal-reverse.svg` at 24 px high, left-aligned at 16 px (copy it from `brand/svg/logo-horizontal/` if it is not in `public/brand/` yet).
- **Nav items** keep their order, routes, icons and `aria-label`s:
  - Expanded: a 40 px row with `px-3 gap-3 rounded-lg mx-2`, the icon at 20 px, and the label `text-sm font-medium` in white at 80% (100% when active).
  - Active row: the Part 11 violet tile colour `#6250E2` as the row background.
  - Hover: `rgb(255 255 255 / 0.08)`.
  - Tooltips show only when collapsed.
  - The active indicator and `aria-current="page"` are unchanged.
- **Toggle:** the last rail row, a 40 px button.
  - Expanded: `ChevronsLeft` plus the label "Collapse".
  - Collapsed: `ChevronsRight` icon only, with the tooltip "Expand sidebar".
  - `aria-expanded` reflects the state, and `aria-controls` points at the nav.
  - `data-testid="rail-toggle"`.
- **Rail element:** `data-testid="app-rail"` and the rail colour stay, and `data-state` is set to the state.
- Below 768 px nothing changes (bottom navigation).
- **Part 11's spec:** `e2e/design/styleChecks.ts` `railCheck` becomes "width is 232 when expanded and 56 after toggling, colour unchanged, active row violet". Log a Decision.

**Hidden UI flag:**
- `src/config/clientEnv.ts` gains `PWA_UI: process.env.NEXT_PUBLIC_PWA_UI === "true"` (default false), and `.env.example` documents `NEXT_PUBLIC_PWA_UI=false`.
- `scripts/e2e/e2e-env.mjs` sets `NEXT_PUBLIC_PWA_UI: "true"`, so spec 14 keeps testing the real feature.
- When false, hide (render nothing):
  - `InstallButton` in the account menu and the Profile "Install app" card;
  - the Push notifications card and the Push column in Settings › Notifications (In-app and Email stay);
  - `OfflineBanner`;
  - any other user-visible mention of install, offline, home screen or push that `grep -rniE "install app|offline|home screen|push notif" src --include=*.tsx` finds outside `src/features/pwa/sw/` and `src/app/offline/`.
- The service worker, the `/offline` fallback page (only ever shown by the worker when the network is gone), the offline store, push code, routes and tests all stay.
- Unit tests: each hidden component renders nothing when the flag is false and its normal UI when it is true (mock `clientEnv`).

### 6.5 Numbers and money (U10)

New `src/lib/format/number.ts` (use the existing currency formatting helpers if they already exist under `src/features/currency`; then this file re-exports and extends them, and you log it):

```ts
export function formatMoney(amountMinor: number, currency: string, opts?: { decimals?: "auto" | 2 }): string
// Intl currency format, en-GB locale default from the user's settings if available. "auto": no fraction digits when the
// amount is a whole major unit (72,500), else 2. 2: always 2 (prices, documents, invoices, payments).
export function formatMoneyCompact(amountMinor: number, currency: string): string   // notation "compact", max 1 fraction digit: £380K, $1.2M
export function formatNumber(value: number, opts?: { compact?: boolean }): string    // grouped (18,500,000) or compact (18.5M)
```

Rules:
- Deal values and every total on the board, list, forecast, deal and Insights tables use `"auto"`.
- Product prices, document lines and totals, invoices and payments use `2`.
- Chart axis ticks use `formatMoneyCompact`, and tooltips use `"auto"`.
- Plain numeric fields (annual revenue, employees, custom number fields) use `formatNumber`.

Unit tests cover:
- whole and fractional amounts;
- JPY (no minor unit);
- negative amounts;
- compact boundaries (999, 1,000, 999,999, 1,000,000).

Never change how amounts are stored or computed; formatting only.

### 6.6 Page structure (U11 to U15)

- **Headings (U11).** The top bar owns the page title (Part 11).
  - Index pages (Documents, Insights, Projects, Products, Leads, People, Organizations, Activities, Inbox) render no content H1 repeating it.
  - Record pages (deal, person, organization, project, document, report, dashboard) keep the record's name as the content H1.
  - Each page has exactly one visible `h1` (e2e checks it).
- **Settings (U12):**
  - The settings layout is two columns: the nav and the content.
  - Nav: 240 px, `sticky top-0 h-[calc(100dvh-56px)] overflow-y-auto`, with group labels "My account" and "Company" in `text-meta font-semibold uppercase tracking-wide text-muted-foreground` and 16 px above each group. Only Part 11's uppercase status-badge rule is exempt from sentence case; these labels opt out with `design-ok: settings group label`.
  - Content: `max-w-[960px] w-full px-8 py-6`, and section panels fill that width.
  - Every settings page must scroll: no ancestor may set `overflow-hidden` with a fixed height around settings content. The e2e check scrolls each settings page at 1440×700 and reaches the last element.
- **Contacts (U13).**
  - Replace the left People, Organizations and Timeline panel with a `ViewSwitcher` in the page toolbar (the same primitive as Activities' List and Calendar), linking the same routes.
  - Person and organization pages lose the panel and use the full width.
- **Toolbar order (U14).** `PageToolbar` holds every control, in this order:
  - left: the view switcher, the primary action (split button where it exists), then the record count in `text-meta text-muted-foreground`;
  - right: saved views, Filter, Ask AI, owner picker, sort, then secondary actions (Export CSV, the settings gear), then the overflow `…`.
  - One row at 1440. Quick filters (Overdue, Today and the rest; type chips) go on a second row inside the toolbar, never above it.
  - Fix Activities, Projects (selects at `w-44`), Documents, Leads, People, Organizations, Deals list and Inbox.
- **Ask AI (U15).**
  - Replace the inline "Describe a filter" card on Leads, People and Organizations with a toolbar button: `Sparkles` icon, "Ask AI".
  - The button opens a 360 px Popover. Inside: a `FormField` labelled "Describe a filter" (the label text stays), a 3-row Textarea, and a primary button "Generate filter".
  - Placeholders:
    - deals: "Open deals over 10,000 closing this month";
    - leads: "Leads from web forms with no activity";
    - people: "People at North Systems added this year";
    - organizations: "Organizations in Media with open deals".
  - The pipeline's "Create new filter" modal keeps its box (spec 04 uses it), with the deals placeholder.
  - Tests that typed into the inline box now open the popover first (log a Decision).

### 6.7 Screens (U6, U16 to U28)

All values use Part 11 tokens and primitives.

**6.7.1 Add deal (U6), `AddDealModal.tsx` on the 6.2 anatomy, size `lg`:**
- Body: `FormGrid columns={2}`. Left column: Contact person, Organization, Title (full span), Value and currency (Combobox, `w-28`), Pipeline, Pipeline stage (full span), Labels, Expected close date, Owner, Source channel and Source channel ID, Visible to, then custom fields.
- Person section: rendered as a full-span group under a 1 px divider with the heading "Person" (`text-sm font-semibold`), not as a separate right column. Phone and Email rows are `FormGrid columns={2}`.
- **Stage picker:**
  - one segment per stage, `h-6`, chevron-shaped as now, with no text inside;
  - the selected segment and those before it use the primary colour, later ones the muted track colour;
  - each segment is a radio (`role="radio"`, `aria-label="{stage name}"`, `aria-checked`) with a tooltip naming the stage;
  - under the track: `{stage name}` in `text-sm font-medium` and `Stage {n} of {total}` in `text-meta text-muted-foreground`;
  - arrow keys move the selection.
- Keep every label text and hook. Spec 07 and the Part 8 add-deal tests must pass.

**6.7.2 Board (U16, U17):**
- **Column header:** 72 px. Line 1: the stage name (`text-sm font-semibold`) and the menu. Line 2: `{total} · {n} deals`. Line 3: `Weighted {weighted}`, plus ` · {k} excluded` when any deals are excluded. Lines 2 and 3 are `text-meta text-muted-foreground truncate`, with a `title` carrying the full text. The chevron shape grows with the height.
- **Card AI score:** an outline pill, `h-5 px-1.5 text-[11px] font-medium rounded-full border`, text "AI {score}". A 6 px dot before it is coloured by band (70 and over success, 40 to 69 warning, under 40 muted), and the pill border is muted. Never a filled green pill. Keep the hook. 11px is a check-design font-size violation: opt out with `design-ok: score pill`.

**6.7.3 Forecast and calendar (U18, U19):**
- **Forecast month header:** a `grid grid-cols-3 gap-2` of stacked cells. Each cell is a label (`text-meta text-muted-foreground`) over a value (`text-sm font-semibold tabular-nums truncate`, with `title` set to the full value via `formatMoney "auto"`). Values use `formatMoneyCompact` when the full value would exceed 9 characters. Minimum column width 240 px; the board scrolls horizontally inside its container.
- **Calendar:**
  - On mount and on view change, the time grid scrolls so 08:00 is at the top, or the earliest timed event of the visible range if that is earlier.
  - Hour rows are 48 px; hour labels `text-meta text-muted-foreground` right-aligned in a 56 px gutter.
  - Today's column header gets the primary colour, and a 2 px current-time line in `--destructive` with a 6 px dot.
  - The all-day row has a minimum height of 32 px and a bottom border.

**6.7.4 Deal stage track and records (U20, U27):**
- **Stage track:** passed and current segments show `{n} day(s)` (Part 11). Future segments show no text. Every segment has a tooltip `{stage name} · {n} day(s)`.
- **Person and organization header:**
  - the name as H1 (the deal title style), labels under it;
  - on the right, the follower control is the same pill component as the deal header ("{n} followers"), with the overflow menu beside it.
- **Detail rows:** `grid grid-cols-[120px_1fr] gap-x-3`, with labels left-aligned `text-meta text-muted-foreground` and values `text-sm`. Numbers use 6.5.

**6.7.5 Document editor (U21):**
- **Header actions** for a draft:
  - primary "Send";
  - secondary buttons "Save draft", "Issue", "Mark as sent", "Copy link", "Print preview";
  - the overflow `…` holds "Delete draft", destructive, with an AlertDialog confirm.
- **Issued documents:** primary "Send again"; secondary "Copy link", "Create invoice", "Duplicate", "Print preview", "Record payment" (invoices); overflow "Void" (invoices).
- **Labels:** keep every existing button name (spec 08 uses "Save draft", "Send" and "Record payment"). The duplicate "Quote" eyebrow goes; the status badge sits beside the H1.
- **Fields:** `FormGrid columns={2}`: Title (full), Valid until or Due date, Customer, Customer email, Customer address (full).
- **Body:**
  - a two-pane area at 1280 px and wider (stacked below that). Left: the existing template textarea, monospace, under a `FormField` "Template text" with the hint "Use {{variables}} from the list. The preview updates as you type.". Right: a live preview, the same renderer as Print preview, in a bordered paper panel (white in both themes);
  - the variable list stays reachable;
  - the bottom footer duplicates nothing that the header has.

**6.7.6 Inbox and thread (U22, U23):**
- **List row:** `grid grid-cols-[32px_200px_1fr_auto_72px] items-center gap-3 h-11 px-4`. The cells are:
  - the checkbox;
  - the sender (truncate, `font-semibold` when unread, preceded by a 6 px unread dot);
  - subject then ` · ` then snippet on one line: the subject in `text-sm font-medium`, the snippet `text-muted-foreground`, truncated together;
  - icons (attachment, lock, labels as chips at most 2, then `+n`);
  - the date, right-aligned `text-meta tabular-nums`.
- **Thread:**
  - the reader column fills the space between the folder rail and the 300 px context panel, with a 24 px gutter, messages `max-w-[880px]`, left-aligned;
  - each message is a card. Its header row: avatar, sender name and address, To line, date on the right. The body is in a paper panel (`bg-white text-neutral-900 rounded-md border p-4`, in both themes, because email HTML assumes white). "Show remote content" is a small secondary button in the header row;
  - the follow-up select gets the visible label "Follow-up".

**6.7.7 Leads, dashboard, insights, projects (U24, U25, U26, U28):**
- **Leads:**
  - "No activity" renders as `text-muted-foreground` with a `CalendarX` icon, not a warning badge;
  - the warning colour only shows when the lead has had no activity for 14 days or more since it was created (computed from existing fields, no new data);
  - source origin values go through a label map: "Web form", "Manually created", "Import", "Outbound", "Referral", "API", and any unknown value is title-cased.
- **Dashboard:**
  - the name is an H1 with inline editing: clicking it or a pencil button turns it into an input, Enter or blur saves through the existing save path, Escape cancels;
  - the toolbar's right side holds Shared (switch with label), "Add widget" (secondary) and "Save" (primary, enabled only when there are unsaved changes);
  - widget cards are 320 px tall with a 14/600 title row and the overflow menu; the axes use 6.5.
- **Insights index:**
  - a table with columns Name, Type (Dashboard or Report), Owner, Shared, Updated;
  - the tabs Dashboards and Reports stay as the view switcher;
  - the empty state follows 6.8.
- **Projects:**
  - list toolbar per 6.6;
  - on the project page, the date pickers show the placeholder "Not set" (not the label text again), and the status select is `w-40`.

### 6.8 Tables, empty states, badges (U29, U30)

- **Tables** (`table-styles.ts`):
  - the header row is sticky inside its scroll container, `bg-background`, with a bottom border;
  - an empty cell renders a hyphen `-` in `text-muted-foreground` with the accessible text "Empty", consistently;
  - the "Showing {n} of {total}" text moves to a table footer row (`h-10 px-4 text-meta text-muted-foreground`, left), with the existing load-more or paging control on the right.
- **Empty states:** use `EmptyState`:
  - a 40 px icon in a muted circle;
  - a title `text-base font-semibold`;
  - one sentence `text-sm text-muted-foreground`;
  - one primary action where the user can create something.

  Apply to:
  - activities (no activities in this view) with "+ Activity";
  - inbox (no conversations);
  - Insights (no dashboards or reports) with "New dashboard";
  - goals, recycle bin, audit log, webhooks, API tokens, connected apps, projects and documents;
  - forms and booking pages.

  Keep the existing empty-state texts that tests read.
- **Top bar badge:** the notification count shows `9+` above 9. Minimum 16 px circle, `text-[10px] font-semibold`, offset so it never covers the bell's centre (`design-ok: badge digit`).

### 6.9 AI JSON reliability (U7)

**`extractJson(text)`** in the new `extractJson.ts`:
1. Trim the text.
2. If it parses as JSON, return it.
3. Else strip a fenced block anywhere in the text (` ```json ... ``` ` or ` ``` ... ``` `) and try again.
4. Else take the substring from the first `{` to its matching closing `}`, counting braces outside strings, and try again.
5. Else return a parse error.

Never `eval`.

**`chatJson`** uses `extractJson`. When the provider reports `finishReason: "length"`, or the content is empty, the error is a new `AppError` id `E_AI_014`. Check `errorIds.ts` for the next free `E_AI_` number and use it; log it.
- `chatJson` retries once with `maxTokens` doubled (capped at 4000), plus the existing "reply with JSON only" nudge.
- A schema mismatch keeps the existing single retry.

**`AiChatResult`** gains `finishReason: string | null`, filled from `choice.finish_reason`.

**The OpenRouter provider:**
- Sends `reasoning: { effort: "low", exclude: true }` on JSON requests. OpenRouter's normalised reasoning control: models without reasoning ignore it.
- Type the request as `ChatCompletionCreateParamsNonStreaming & { reasoning?: { effort: "low" | "medium" | "high"; exclude?: boolean } }`.
- Keeps `response_format: { type: "json_object" }`.
- Logs, through the existing logger at `warn`, `{ feature, finishReason, contentLength }` only on a JSON failure. Never log the content.

**Email draft:** default `maxTokens` 1500.

**Fake provider:** unchanged. The scripted provider gains `finishReason`.

**Unit tests** (`extractJson.test.ts`, `chatJson.test.ts`):
- bare JSON;
- a fenced block with prose before and after;
- prose with an embedded object;
- nested braces inside strings;
- truncated JSON giving `E_AI_014`;
- empty content with `finishReason: "length"` retrying with doubled tokens and succeeding;
- a schema mismatch retrying once.

**UI** (email draft, notes to activities, AI filter, describe-it, explain):
- Replace "The AI reply could not be understood. Try again." with "The AI couldn't finish that reply. Try again, or shorten your request.", plus a "Try again" button that resubmits the same input.
- Keep the error id in the console only.

### 6.10 `check-design` additions

Add two rules to `scripts/dealflow/check-design.mjs`, the same way Part 11 rules are written:
- `dialog-anatomy`: a file containing `<DialogContent` must also contain `DialogHeader` or `closeButton="corner"` or `closeButton="none"`; and no file in `src` may contain `-mt-6` or `-mx-6` next to `DialogHeader` or `DialogFooter`.
- `select-long-list`: a `<Select` whose `options` prop is a known long list (`supportedCurrencyCodes`, `currencyOptions`, `timeZoneOptions`, `Intl.supportedValuesOf`) is a violation. Use `Combobox`.

Opt-outs use the existing `design-ok: {reason}` syntax. At most 15 new opt-outs in this part.

### 6.11 Polish e2e spec

`e2e/16-polish.spec.ts` uses the e2e harness (production build, `NEXT_PUBLIC_PWA_UI` true there, so the hidden-UI test sets up its own expectation; see below). The test titles are exactly: `dialog anatomy`, `long list`, `rail`, `hidden ui`, `headings`, `settings scroll`, `forecast`, `calendar`, `board header`, `gallery` (the gates select them with `--grep`). Checks:

1. **Dialog anatomy:** open Add deal, Add person, Add activity and Log call.
   - For each: the title's bounding box lies fully inside the dialog's box, and the top gap is at least 12 px.
   - `[data-testid="dialog-close"]` lies inside the header box and does not intersect the header's bottom border.
   - Scroll the body to the bottom: the header and footer boxes are unchanged.
2. **Long list:** on Settings › Currencies, open the base currency combobox, type "zar", and "ZAR, South African Rand" is an option. Then open any Select with more than 12 options (the activity type filter, or a Select found in Task 1.2, recorded in the spec):
   - the viewport `scrollHeight` exceeds its `clientHeight`;
   - pressing End makes the last option visible inside the viewport.
3. **Rail:**
   - at 1440 the rail is 232 px with visible labels;
   - clicking `rail-toggle` makes it 56 px, and labels are hidden;
   - after a reload it is still 56 px;
   - toggling back restores 232;
   - `[` toggles it too.
4. **Hidden UI:** build-flag dependent. Because e2e builds with the flag on, cover the off state with the unit tests in 6.4. Here, assert that with the flag on, the account menu shows "Install app" (proves the flag wiring), and log that the off state is unit-tested.
5. **Headings:** on Documents, Insights, Projects, People and Leads, exactly one visible `h1`, and it is in the top bar.
6. **Settings scroll:** for every settings route in `e2e/polish/routes.ts`, at 1440×700 scroll the content's scroll container to the end; its last element is in the viewport.
7. **Forecast:** in the first month column, the Total, Weighted and Won value boxes do not intersect each other.
8. **Calendar:** in week view, the 08:00 label is visible without scrolling.
9. **Board header:** no column header text node is ellipsized (`scrollWidth <= clientWidth`) at 1440 for the seeded totals.
10. **Gallery:** add `polish-{name}-1440-{light|dark}.png` for:
    - add-deal, currencies-open, rail-expanded, rail-collapsed;
    - forecast, calendar, document-editor;
    - thread, leads, dashboard.

    That is 10 names × 2 themes = 20 files in `e2e/screenshots/design/`.

## 7. Conventions

Same as Parts 1 to 11 (CLAUDE.md is the authority). In addition:
- Layout and reliability only. Never change data, routes or business behaviour beyond the rail cookie and the hidden-UI flag.
- Every visual value comes from a Part 11 token, scale step or primitive, or from a number in section 6. Never eyeball a value.
- Keep every test hook. When a contract in 6.1 moves a control (Ask AI popover, document overflow menu, contacts view switcher), update the affected tests to the new path without weakening an assertion, and log one Decision per group of tests.
- `check-design` stays at 0 violations. Each screen task's Verify includes `pnpm check:design {its files}` → 0.
- Dark mode is checked for every touched screen: contrast stays AA (axe in spec 15 and 16), and no white surface appears outside the paper panels (email bodies, the document preview).

## 8. Phases and tasks

`E2E` below means `MINIO_PORT=9100 DEV_PG_PORT=5433` in front of the command (section 4). A polish subset run is `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e:build && MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/16-polish.spec.ts --grep "{titles}"`, with the test titles from 6.11.

### Phase 0: Start

#### Task 0.1 - Start Part 12: progress files, kit, baseline and environment

**Goal:** A Part 12 PROGRESS.md, the dev stack on free ports, and a green baseline.

**Files:** create `PROGRESS.md`, `docs/dealflow/POLISH.md`; rename `PROGRESS.md` → `PROGRESS-P11.md`; possibly root symlink `PLAN-PART12.md` and the checker copy `scripts/check-progress.mjs`

**Steps:**
1. Check section 4's table and log each result as a Decision.
2. `git mv PROGRESS.md PROGRESS-P11.md`, then create PROGRESS.md in the section 0 format with every task unchecked:
   - record the Phase 0 base commit;
   - copy `PROGRESS-P11.md` → Environment and replace the dev-stack and e2e lines with the section 4 commands;
   - carry over still-open owner actions.
3. If the kit is in a subfolder, create the root symlink and the byte-identical checker copy.
4. Run `DEV_PG_PORT=5433 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm dev:up`, and confirm Postgres answers: `pg_isready -h localhost -p 5433` or a `psql` select 1 through Docker.
5. Baseline: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (with the Environment prefixes), `pnpm test:unit`, `pnpm check:design`. Log `- Baseline: ...` with counts.
6. Write `docs/dealflow/POLISH.md`: the 6.1 table plus two empty columns, "Closed in task" and "Commit".
7. Commit `0.1: Start Part 12: progress files, kit, baseline and environment`, tick.

**Verify:** `pnpm check:progress && test -s docs/dealflow/POLISH.md` → exits 0

**Done when:** the baseline is green and logged, and the dev stack runs without touching `dealflow-prod`.

#### Task 0.2 - Polish e2e spec and the two check-design rules

**Goal:** The referee exists before the work starts.

**Files:** create `e2e/16-polish.spec.ts`, `e2e/polish/checks.ts`, `e2e/polish/routes.ts`; modify `scripts/dealflow/check-design.mjs`, `docs/dealflow/POLISH.md`

**Steps:**
1. Add the 6.10 rules to `check-design.mjs`. Run `pnpm check:design --json /tmp/polish-baseline.json` and record the per-rule counts in POLISH.md.
2. Write `e2e/polish/routes.ts`: every `src/app/(app)/settings/**/page.tsx` route without a dynamic segment.
3. Write `e2e/polish/checks.ts` with helpers: `box(locator)`, `intersects(a, b)`, `isEllipsized(locator)`, `scrollToEnd(locator)`.
4. Write `16-polish.spec.ts` with the ten 6.11 tests, using exactly the titles in 6.11. They are expected to fail until their tasks land. Never mark them `.skip`, `.fixme` or `.only`.
5. Commit `0.2: Polish e2e spec and the two check-design rules`, tick.

**Verify:** `pnpm typecheck && pnpm check:design --json /tmp/polish-baseline.json; test -s /tmp/polish-baseline.json` → the JSON exists and names both new rules

**Done when:** the rules report and the spec compiles.

#### Task 0.3 - Phase 0 QA gate

**Goal:** Phase 0 is green.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3) with the two new rules' counts. Record the Phase 1 base commit, commit `0.3: Phase 0 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → only `dialog-anatomy` and `select-long-list` may report violations at this point

**QA focus:** the baseline is honest, and the spec has real assertions for all ten checks.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 1: Primitives and AI reliability

#### Task 1.1 - Dialog, alert dialog and sheet anatomy, every dialog migrated (U1)

**Goal:** No clipped titles and no close button on a rule, anywhere.

**Files:** modify `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `dialog.test.tsx`, `src/features/entity-create/EntityCreateDialogShell.tsx`, and every file from `grep -rlE "DialogContent|SheetContent|AlertDialogContent" src`

**Steps:**
1. Implement 6.2 in the three primitives and add the 6.2 unit tests.
2. Migrate every usage:
   - fields go into `DialogBody` or `SheetBody`;
   - remove `p-0`, negative margins and per-usage header or footer padding;
   - choose `closeButton` for headerless dialogs.
3. Run `pnpm check:design` until `dialog-anatomy` is 0, and `pnpm vitest run` on every touched folder.
4. Fill POLISH.md's U1 row, commit `1.1: Dialog, alert dialog and sheet anatomy, every dialog migrated (U1)`, tick.

**Verify:** `pnpm vitest run src/components/ui src/features/entity-create` → passes

**Done when:** every dialog uses the anatomy and `dialog-anatomy` reports 0.

#### Task 1.2 - Scrolling Select, searchable Combobox, one trigger style (U2, U3, U9)

**Goal:** Every long list scrolls or searches, and all pickers look alike.

**Files:** modify `src/components/ui/Select.tsx`, `Combobox.tsx` and their tests, `src/features/currency/ui/CurrenciesSettings.tsx`, the deal and product currency pickers, the time zone pickers, and any other long list found with `grep -rn "<Select" src`

**Steps:**
1. Implement 6.3 for Select and Combobox, with the Select unit test for a 200-option list.
2. Replace every long-list Select with Combobox, and log the files in one Decision.
3. Record in `e2e/polish/routes.ts` which Select the "long list" test opens.
4. `pnpm check:design` → `select-long-list` 0. Fill POLISH.md rows U2, U3 and U9, commit, tick.

**Verify:** `pnpm vitest run src/components/ui src/features/currency` → passes

**Done when:** no long list renders as a plain Select, and Select lists scroll inside the viewport.

#### Task 1.3 - FormField and FormGrid on create dialogs and settings forms (U8)

**Goal:** One field rhythm everywhere.

**Files:** create `src/components/ui/form-field.tsx` and `form-field.test.tsx`; modify the dialogs and settings forms listed in 6.3

**Steps:**
1. Implement 6.3 `FormField` and `FormGrid` with unit tests: label association, required marker, error over hint, `role="alert"`.
2. Apply them to the listed dialogs and forms, keeping every label text, `id` and `data-testid`.
3. Run `pnpm vitest run` on the touched folders and `pnpm check:design`.
4. Fill POLISH.md row U8, commit, tick.

**Verify:** `pnpm vitest run src/components/ui` → passes

**Done when:** the listed forms use FormField and keep their hooks.

#### Task 1.4 - Number and money formatting (U10)

**Goal:** No raw decimals and no `.00` axis ticks.

**Files:** create `src/lib/format/number.ts` and `number.test.ts`; modify `src/components/ui/chart.tsx`, the Insights widgets, products settings, organization fields, and the board, list, forecast and document totals that format by hand

**Steps:**
1. Write the 6.5 tests first (money is risky logic).
2. Implement 6.5 (re-export the existing currency helpers if they exist, and log it).
3. Replace hand formatting found with `grep -rnE "toFixed\(2\)" src`, and the raw value renders on the listed screens.
4. Fill POLISH.md row U10, commit, tick.

**Verify:** `pnpm vitest run src/lib/format` → passes

**Done when:** the tests pass and the listed screens use the helpers.

#### Task 1.5 - Tables, empty states and the bell badge (U29, U30)

**Goal:** Tables and empty pages look finished.

**Files:** modify `src/components/ui/table-styles.ts`, `EmptyState.tsx` and their tests, the list pages in 6.8, the top-bar notification button

**Steps:**
1. Implement the 6.8 table rules: sticky header, empty cell, footer count row.
2. Apply `EmptyState` to the 6.8 list, keeping existing empty texts that tests read.
3. Cap the badge at `9+`, with a unit test.
4. Fill POLISH.md rows U29 and U30, commit, tick.

**Verify:** `pnpm vitest run src/components/ui src/components/shell` → passes

**Done when:** 6.8 is implemented on every listed page.

#### Task 1.6 - AI JSON reliability and the humane error (U7)

**Goal:** AI drafts stop failing on reasoning models and wrapped replies.

**Files:** create `src/features/ai/extractJson.ts` and `extractJson.test.ts`; modify `chatJson.ts` and its test, `openrouterProvider.ts`, `types.ts`, `scriptedProvider.ts`, `emailDraft.ts`, `src/constants/errorIds.ts`, the AI error strings, and the five UIs in 6.9

**Steps:**
1. Write the 6.9 unit tests first.
2. Implement 6.9: `extractJson`, `finishReason`, the truncation retry, the `reasoning` field, metadata-only warn logging, `maxTokens` 1500 for drafts, and the new error id.
3. Replace the UI error text and add the "Try again" button in the five UIs.
4. Run `pnpm vitest run src/features/ai`. Then run the AI integration files the way Part 11 ran named integration files (check `package.json` for the integration config): `src/features/ai/*.integration.test.ts`.
5. Fill POLISH.md row U7, commit, tick.

**Verify:** `pnpm vitest run src/features/ai` → passes

**Done when:** every 6.9 test passes and the AI integration files pass.

#### Task 1.7 - Phase 1 QA gate

**Goal:** Prove the primitives.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 2 base commit, commit `1.7: Phase 1 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- the polish subset with `--grep "dialog anatomy|long list"` → passes
- `src/features/ai/*.integration.test.ts` → pass

**QA focus:** DoD items 2, 3 and 6; no test hook lost in the dialog migration.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 2: Shell and navigation

#### Task 2.1 - Expandable rail with labels (U4)

**Goal:** The rail expands to labels, collapses to icons, and remembers.

**Files:**
- create `src/components/shell/railState.ts`, `RailToggle.tsx` and their tests;
- modify `LeftNav.tsx`, the app layout that renders it, `src/features/shortcuts/registry.ts`, `e2e/design/styleChecks.ts`;
- copy into `public/brand/` the reverse horizontal logo if it is missing.

**Steps:**
1. Implement 6.4, with the cookie read on the server so the first paint has the right width.
2. Unit tests:
   - cookie parsing: missing or invalid gives `"expanded"`, valid gives the value;
   - the toggle flips the state and sets `aria-expanded`;
   - `[` is ignored inside inputs.
3. Update `railCheck` to the new contract and log the Decision.
4. Fill POLISH.md row U4, commit, tick.

**Verify:** `pnpm vitest run src/components/shell src/features/shortcuts` → passes

**Done when:** the unit tests pass and the rail renders both states.

#### Task 2.2 - Hide install, offline and push UI behind NEXT_PUBLIC_PWA_UI (U5)

**Goal:** No install, offline or push mention by default, and nothing deleted.

**Files:** modify `src/config/clientEnv.ts`, `.env.example` (append), `scripts/e2e/e2e-env.mjs`, `src/features/pwa/InstallButton.tsx`, `OfflineBanner.tsx`, the Profile install card, the Settings › Notifications push card and column, and any other mention found; add the 6.4 unit tests

**Steps:**
1. Implement the 6.4 flag.
2. Run the 6.4 grep and log every hidden surface in one Decision.
3. Unit tests: each surface renders nothing with the flag false, and its normal UI with it true.
4. Fill POLISH.md row U5, commit, tick.

**Verify:** `pnpm vitest run src/features/pwa src/features/push src/config` → passes

**Done when:** the unit tests prove both flag states.

#### Task 2.3 - One heading per page and the settings layout (U11, U12)

**Goal:** One h1 per page, and settings pages that use the width and always scroll.

**Files:** modify the index pages listed in 6.6, the settings layout (`src/app/(app)/settings/layout.tsx` or `SettingsSurface`) and the settings nav

**Steps:**
1. Remove the duplicate H1s per 6.6.
2. Implement the 6.6 settings layout (nav, content width, scroll rule).
3. Run `pnpm vitest run "src/app/(app)/settings"` and `pnpm check:design`.
4. Fill POLISH.md rows U11 and U12, commit, tick.

**Verify:** `pnpm vitest run "src/app/(app)/settings"` → passes

**Done when:** 6.6's heading and settings rules hold.

#### Task 2.4 - Contacts view switcher (U13)

**Goal:** People, Organizations and Timeline switch from the toolbar, and records use the full width.

**Files:** modify the contacts layout, the people, organizations and timeline pages, and the person and organization record pages

**Steps:**
1. Replace the left panel with `ViewSwitcher` links to the same routes.
2. Remove the panel from the record pages.
3. Run the touched folders' unit tests.
4. Fill POLISH.md row U13, commit, tick.

**Verify:** `pnpm vitest run src/features/contacts "src/app/(app)/contacts"` → passes

**Done when:** no contacts page renders the old left panel.

#### Task 2.5 - Toolbar order and the Ask AI popover (U14, U15)

**Goal:** Every toolbar has one order, and the AI filter lives in a popover.

**Files:** modify `src/components/ui/page-toolbar.tsx`, `src/features/ai/ui/AiFilterBox.tsx`, the toolbars of the 6.6 pages, and the tests that used the inline box

**Steps:**
1. Implement the 6.6 toolbar order on the listed pages.
2. Build the Ask AI popover with the entity placeholders. The pipeline modal keeps its box.
3. Update the tests that used the inline box (open the popover first), and log a Decision.
4. Fill POLISH.md rows U14 and U15, commit, tick.

**Verify:** `pnpm vitest run src/features/ai src/components/ui` → passes

**Done when:** the listed toolbars follow 6.6 and the popover works.

#### Task 2.6 - Phase 2 QA gate

**Goal:** Prove the shell and navigation.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3). Record the Phase 3 base commit, commit `2.6: Phase 2 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`
- the polish subset with `--grep "rail|hidden ui|headings|settings scroll"` → passes
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/14-pwa-mobile.spec.ts e2e/15-design.spec.ts` → passes

**QA focus:** DoD items 4 and 5; the hidden UI is gated, not deleted.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 3: Screens

#### Task 3.1 - Add deal dialog (U6)

**Goal:** A balanced Add deal dialog with a readable stage picker.

**Files:** modify `src/features/deals/AddDealModal.tsx` and its stage picker (or create `src/features/deals/StagePicker.tsx`), and their tests

**Steps:**
1. Implement 6.7.1: the FormGrid layout, the Person group, the currency Combobox, and the stage picker as radios with tooltips, a caption and arrow keys.
2. Unit tests for the stage picker: the caption text, the arrow keys, `aria-checked`.
3. Run `pnpm vitest run src/features/deals`.
4. Fill POLISH.md row U6, commit, tick.

**Verify:** `pnpm vitest run src/features/deals` → passes

**Done when:** the dialog matches 6.7.1 with every hook intact.

#### Task 3.2 - Board column header and card score (U16, U17)

**Goal:** Board headers never truncate, and score pills are calm.

**Files:** the board column header and card components under `src/features/deals/`, `src/app/globals.css` (column shape height), `e2e/design/styleChecks.ts` (header height contract)

**Steps:**
1. Implement 6.7.2.
2. Update the Part 11 header-height check to 72 and log the Decision.
3. Run the touched unit tests and `pnpm check:design`.
4. Fill POLISH.md rows U16 and U17, commit, tick.

**Verify:** `pnpm vitest run src/features/deals` → passes

**Done when:** 6.7.2 holds.

#### Task 3.3 - Forecast header and calendar (U18, U19)

**Goal:** Readable forecast totals, and a calendar that opens on working hours.

**Files:** the forecast column header component under `src/features/forecast/`, the calendar time grid under `src/features/activities/`

**Steps:**
1. Implement the 6.7.3 forecast header.
2. Implement the 6.7.3 calendar: the scroll to 08:00, row heights, today and the current-time line.
3. Run the touched unit tests.
4. Fill POLISH.md rows U18 and U19, commit, tick.

**Verify:** `pnpm vitest run src/features/forecast src/features/activities` → passes

**Done when:** 6.7.3 holds.

#### Task 3.4 - Stage track, person and organization records (U20, U27)

**Goal:** Honest stage labels, and tidy record headers and fields.

**Files:** `src/features/deals/ui/StageTrack.tsx` and its test, and the person and organization detail header and field-row components

**Steps:**
1. Implement the 6.7.4 track labels and tooltips. Update tests that read "0 days" on future stages, and log it.
2. Implement the 6.7.4 record header and the field grid with 6.5 number formatting.
3. Run the touched unit tests.
4. Fill POLISH.md rows U20 and U27, commit, tick.

**Verify:** `pnpm vitest run src/features/deals src/features/contacts` → passes

**Done when:** 6.7.4 holds.

#### Task 3.5 - Document editor (U21)

**Goal:** A document editor with a clear action hierarchy and a live preview.

**Files:** the document detail and editor components under `src/features/documents/ui/` and their tests

**Steps:**
1. Implement the 6.7.5 header actions and overflow menu, with the AlertDialog confirm for Delete draft.
2. Implement the field grid and the two-pane template editor and preview.
3. Run `pnpm vitest run src/features/documents`. Spec 08's button names must stay.
4. Fill POLISH.md row U21, commit, tick.

**Verify:** `pnpm vitest run src/features/documents` → passes

**Done when:** 6.7.5 holds with spec 08's names intact.

#### Task 3.6 - Inbox list and thread reader (U22, U23)

**Goal:** A scannable inbox and a comfortable reader in both themes.

**Files:** `src/features/email/ThreadRow.tsx`, `ThreadList.tsx`, `ThreadPane.tsx`, `ReaderMessageCard.tsx`, `MessageBodyFrame.tsx`, `ThreadFollowUpControls.tsx` and their tests

**Steps:**
1. Implement the 6.7.6 list row grid.
2. Implement the 6.7.6 reader: the column width, the message card, the paper body panel and the labelled follow-up select. The email body sandbox stays exactly as now.
3. Run `pnpm vitest run src/features/email`.
4. Fill POLISH.md rows U22 and U23, commit, tick.

**Verify:** `pnpm vitest run src/features/email` → passes

**Done when:** 6.7.6 holds and the masking and privacy tests still pass.

#### Task 3.7 - Leads, dashboard, Insights index and projects (U24, U25, U26, U28)

**Goal:** These four screens look finished.

**Files:** the leads list cells under `src/features/leads/`, the dashboard header under `src/features/insights/`, the Insights index page, the projects list and project header under `src/features/projects/`

**Steps:**
1. Leads: the calm "No activity", the 14-day warning rule and the source label map (unit test the map).
2. Dashboard: the inline-editable title and toolbar, and the 320 px widget cards.
3. Insights index table and empty state; projects toolbar, date placeholder and status width.
4. Run the touched unit tests, fill POLISH.md rows U24, U25, U26 and U28, commit, tick.

**Verify:** `pnpm vitest run src/features/leads src/features/insights src/features/projects` → passes

**Done when:** 6.7.7 holds.

#### Task 3.8 - Phase 3 QA gate

**Goal:** Prove the screens.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run the gate commands; fix until green (rule 9.1).
2. `pnpm check:progress`; fix what it reports.
3. Log the QA line (rule 9.3) with the opt-out count added in this part. Record the Phase 4 base commit, commit `3.8: Phase 3 QA gate`, tick, end the session.

**Gate commands:**
- `pnpm typecheck` → exits 0
- `pnpm lint` → exits 0
- `pnpm build` → exits 0
- `pnpm test:unit` → passes
- `pnpm check:design` → `0 violation(s)`, at most 15 opt-outs added in this part
- the polish subset with `--grep "forecast|calendar|board header"` → passes
- `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm exec playwright test e2e/07-sales.spec.ts e2e/08-documents.spec.ts e2e/06-mail.spec.ts e2e/11-insights.spec.ts e2e/12-projects-data.spec.ts` → passes

**QA focus:** DoD item 1 for U6 and U16 to U28; dark mode on every touched screen.

**Verify:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → exits 0

**Done when:** gate commands are green and the QA log line exists.

### Phase 4: Proof and hand-off

#### Task 4.1 - User guide update and PDFs

**Goal:** The guide matches the app.

**Files:** modify `docs/user-guide/getting-started.md`, `troubleshooting-faq.md`, `notifications.md`, `contacts-and-organizations.md`, `pipelines-and-deals.md`, `quotes-and-invoices.md`, `admin.md`, `_inventory.md`; regenerate `docs/user-guide/pdf/*`

**Steps:**
1. Describe the expandable rail (Collapse, Expand sidebar, the `[` key) in Getting started.
2. Wrap every install, offline and push passage, and its image, in `<!-- hidden while NEXT_PUBLIC_PWA_UI is off -->` and `<!-- end hidden -->`. The text stays in the file and disappears from the PDFs.
3. Update the Ask AI steps, the contacts view switcher and the document editor action names.
4. Run `pnpm docs:pdf`, with `DOCS_CHROME` set to the Playwright Chromium from Environment if needed. Commit `4.1: User guide update and PDFs`, tick.

**Verify:** `ls docs/user-guide/pdf/*.pdf | wc -l` → `15`

**Done when:** the guide text matches Part 12 and the PDFs are rebuilt.

#### Task 4.2 - End-to-end and gallery

**Goal:** The whole e2e suite is green and the gallery is complete.

**Files:** modify `PROGRESS.md`; any files the fixes need; `e2e/screenshots/design/*.png`

**Steps:**
1. Run `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` (specs `00` to `16`). Fix the app, not the tests, except the logged section 3 contract changes.
2. Confirm 73 Part 11 files plus 20 polish files, 93 in all.
3. Commit `4.2: End-to-end and gallery`, tick.

**Verify:** `ls e2e/screenshots/design/*.png | wc -l` → `93`

**Done when:** e2e is green and the gallery has 93 files.

#### Task 4.3 - Integration suite and smoke

**Goal:** The once-per-part full runs.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Run `pnpm test:integration` (full).
2. Run `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`. Expect SMOKE PASS with "backup round trip ok (3 deals)", and no `dealflow-smoke` leftovers.
3. Log both, commit `4.3: Integration suite and smoke`, tick.

**Verify:** `grep -c "SMOKE PASS\|smoke: SKIPPED" PROGRESS.md` → at least `1`

**Done when:** both ran and are logged.

#### Task 4.4 - Independent review

**Goal:** One fresh-context review of Part 12.

**Files:** modify `PROGRESS.md`; any files the fixes need

**Steps:**
1. Use the harness `subagent` tool. Its task text is:
   - the full `.dsh/qa.md`;
   - a blank line;
   - `Final review of PLAN-PART12.md. Base commit {Phase 0 base}.`;
   - "Also check the 30 rows of 6.1 one by one against the code and the polish spec, open each dialog file to confirm the 6.2 anatomy, confirm the hidden UI is gated and not deleted, and check that every test change matches a logged Decision."

   Fallbacks: `qa.sh` with the same request, then an evidenced self-review.
2. Fix every blocker and major and commit `4.4: QA fixes round {r}`, at most 3 rounds. After the last round, re-run the Task 3.8 gate commands, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` and `pnpm test:integration`.
3. Log `- Independent review: {how} round {r}: QA RESULT {PASS|FAIL} · {blockers}/{majors}/{minors} · fixed {n}`.
4. Commit `4.4: Independent review`, tick.

**Verify:** `grep -c "^- Independent review" PROGRESS.md` → at least `1`

**Done when:** the review ran, blockers and majors are fixed or logged, and the final tree has green evidence.

#### Task 4.5 - Final checklist

**Goal:** Run section 11 and record the evidence.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Run every item of section 11 in order. Write one line per item under PROGRESS.md → Final report → Checklist: `{n}. PASS|FAIL|SKIPPED - {evidence}`.
2. Commit `4.5: Final checklist`, tick.

**Verify:** `grep -cE '^[0-9]+\. (PASS|FAIL|SKIPPED)' PROGRESS.md` → at least `18`

**Done when:** every checklist item has a line.

#### Task 4.6 - Final report and completion

**Goal:** Hand the owner a short, truthful report.

**Files:** modify `PROGRESS.md`

**Steps:**
1. Write PROGRESS.md → Final report, short (the owner reads it on a phone):
   - DoD items 1 to 9, one line each;
   - the Checklist;
   - Owner actions, numbered, with exact commands:
     - rebuild the live install to see Part 12;
     - review `e2e/screenshots/design/polish-*` in dark and light;
     - regenerate the user-guide screenshots later with `pnpm docs:screenshots` against a dev-mode seeded app, because they still show the old rail;
   - `CONTRACT CHANGE:` lines and changed tests;
   - Open issues.

   Do not repeat the Decisions list.
2. `pnpm check:progress --final` must pass.
3. Set `STATUS: COMPLETE` (or `STATUS: COMPLETE WITH OPEN ISSUES`), commit `4.6: Final report and completion`, tick, and end with "Build finished. Read PROGRESS.md → Final report."

**Verify:** `grep -c "^STATUS: COMPLETE" PROGRESS.md` → `1`

**Done when:** the report is complete and the final check passed.

## 9. Out of scope

- New features, routes, data or business behaviour.
- Deleting PWA, offline or push code (hide only).
- Mobile-specific work beyond keeping 375 px free of horizontal scroll.
- `site/` and `website/`, and the separate website repo.
- New dependencies, a new icon set, a new font, or any token change outside what section 6 names.
- Re-capturing the user-guide screenshots (that needs a dev-mode seeded app on the owner's ports; it is an owner action).
- Changing email templates.

## 10. ASK and STOP triggers

This plan has no ASK triggers. The only STOP cases are the fatal ones in section 4.

| Situation | Safe default | Owner action to log |
|---|---|---|
| Docker stops or fills up after Task 0.1 | try `open -a Docker` and the section 4 dev:up command once; still failing → SKIPPED, finish the non-Docker tasks, `COMPLETE WITH OPEN ISSUES` | "Restart Docker Desktop or give it more disk, then run `pnpm test:integration`, `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e`, `COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=0 pnpm smoke`" |
| Port 5433 or 9100 taken | next free port in steps of 10; record it in Environment | none |
| Subagent tool unavailable | `qa.sh`, then an evidenced self-review | "Run the review yourself with `.dsh/qa.md` and the Task 4.4 request" |
| OpenRouter rejects the `reasoning` field in a real call | cannot be seen in this run (no real AI calls); keep it, because OpenRouter documents it | "If AI drafts fail after Part 12, set `OPENROUTER_MODEL` to a non-reasoning model and tell the planner" |
| A dialog genuinely cannot use a header (a full-bleed preview) | `closeButton="corner"` and log it | none |
| A test reads text that 6.7 removes (for example "0 days" on future stages) | update it to the new contract and log a Decision; never delete the assertion | none |
| More than 15 new opt-outs needed | fix the cheapest until at most 15, then log the rest as Open issues | "Review the remaining design exceptions" |
| Google env in `.env` still partial | keep the Environment prefixes | "Set all three GOOGLE_* values or blank all three in .env" |

## 11. Final checklist

1. `git --no-optional-locks status --porcelain` is empty, ignoring the untracked files the owner left in `site/public/`.
2. `pnpm install --frozen-lockfile` exits 0, and no dependency was added in this part.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0.
5. `pnpm test:unit` passes, with a count of at least the baseline plus the new tests.
6. `pnpm test:integration` passes on the final tree.
7. `pnpm build` exits 0.
8. `MINIO_PORT=9100 DEV_PG_PORT=5433 pnpm e2e` passes, specs `00` to `16`, on the final tree.
9. `ls e2e/screenshots/design/*.png | wc -l` is 93.
10. Smoke printed SMOKE PASS and `backup round trip ok (3 deals)`.
11. `pnpm check:design` prints `0 violation(s)`, with the two new rules active and at most 15 opt-outs added in this part.
12. `docs/dealflow/POLISH.md` shows U1 to U30 each closed, with a task and a commit.
13. `grep -rn "\-mt-6\|-mx-6" src/components/ui/dialog.tsx` prints nothing, and `grep -c DialogBody src/components/ui/dialog.tsx` is at least 1.
14. With `NEXT_PUBLIC_PWA_UI` unset, the unit tests prove the hidden UI renders nothing (cite the test names).
15. The 6.9 unit tests pass (cite them).
16. No em dash in any file added or changed in this part (`git diff --name-only {Phase 0 base} | xargs perl -CSD -ne 'print "$ARGV\n" if /\x{2014}/' | sort -u` prints nothing, kit files excepted).
17. `docs/dealflow/UPSTREAM.md` lists this part's upstream file changes under "Part 12".
18. `pnpm check:progress --final` passes.

## 12. Report back

No mid-run reporting. The run ends with the final report (Task 4.6). The owner pastes PROGRESS.md → Final report back to the planner (the Decisions list is not needed), plus any polish gallery screenshots that still look wrong.

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

You are the QA reviewer for a build made from plan files in this folder (PLAN-PART1.md to PLAN-PART12.md, one per part). You did not write this code. Assume the builder cut corners and verify everything yourself.

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
5. Also check: no secrets committed; no `.skip` or `.only`; no weakened or deleted assertions; no stray debug logging; every server action checks CSRF, the actor and permissions; auth tokens are hashed and consumed in one statement; no sign-in route reveals whether an email exists; dev-login is unreachable in production; AI calls check caps, visibility and the rate limit before calling the provider; assistant write tools only run on confirm by the action's owner; mail passwords are encrypted and never logged or returned; Bcc never reaches the SMTP wire copy; sync cursors advance only after messages are stored; money is computed on integer minor units with no floats, converted totals never add unconverted amounts or drop deals silently (excluded deals are listed), the forecast reuses the deals visibility filter; document public routes take only the publicId and a validated body, never render HTML, issued documents are immutable; domain events are written inside the mutation's transaction, automation actions go through existing services and respect the loop guard, webhook delivery checks every resolved address inside the DNS lookup with no redirects, webhook secrets are encrypted and never returned after creation; public form and booking handlers write nothing on spam paths, bookings re-check the slot under a per-host lock in the same transaction, only `/f/*` and `/book/*` may be framed; reports apply the deals or activities visibility clause, never add values across currencies in SQL, send only aggregated rows to the AI; API calls authenticate only by hashed bearer token and run as the token's user through existing services, exports reuse list visibility, backups keep secrets out of argv and logs, download routes refuse path traversal; bulk actions and undo call the existing services, the next recurring occurrence is created once inside the completion transaction, duplicates respect visibility; the service worker never caches authenticated HTML or API responses, offline data is per user and wiped on sign-out, the VAPID private key never reaches the client; the restyle changes no behaviour or test hook, every visual value matches the plan's measured Pipedrive spec (section 6) through tokens or primitives, no Pipedrive asset is copied, and `check-design` opt-outs carry a genuine reason; dialogs put the close button in the header and scroll only their body, long lists scroll or search, the hidden install, offline and push UI is gated by NEXT_PUBLIC_PWA_UI and not deleted, AI JSON parsing never logs reply content; no em dashes in new files.
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
# Usage: ./qa.sh "Final review of PLAN-PART12.md. Base commit <hash>."     Optional: DSH_QA_MODEL=<model id>
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

const PLAN_FILE = process.env.PLAN_FILE || "PLAN-PART12.md";
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
const KIT = String.raw`["']?(\./)?(AGENTS\.md|loop\.sh|qa\.sh|dsh-setup\.sh|PLAN-PART(?:1[0-2]|[1-9])\.md|ROADMAP\.md|AMENDMENTS-P1-1\.md|scripts/check-progress\.mjs|\.dsh/\S*)`;
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
  [/dealflow-prod/, "the owner's live dealflow-prod stack is off limits"],
  [/\.env\.production\b/, ".env.production belongs to the owner's live install"],
  [/(localhost|127\.0\.0\.1):(3001|8080|9000)\b/, "ports 3001, 8080 and 9000 belong to the owner's live stack"],
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
# Relaunches the builder (DeepSeek Harness, headless) with a fresh context until PLAN-PART12.md (dealflow-wd-p12-v1) is finished.
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
PROMPT='Read PLAN-PART12.md in this folder in full and PROGRESS.md, then follow PLAN-PART12.md section 0 exactly: continue autonomously from the first unchecked task (or Task 0.1 if PROGRESS.md does not belong to dealflow-wd-p12-v1; earlier parts are finished) without asking questions or waiting for approval. Decide and log instead of asking. Finish the current phase including its gate, then end this run as section 0 rule 3 says. The whole build ends only when PROGRESS.md (dealflow-wd-p12-v1) says STATUS: COMPLETE.'
finished() { grep -q "dealflow-wd-p12-v1" PROGRESS.md 2>/dev/null && grep -qE '^STATUS: (COMPLETE|BLOCKED)' PROGRESS.md; }
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
- Otherwise you are the builder: read `PLAN-PART12.md` in full (Parts 1 to 11 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART12.md rule 18.
```
