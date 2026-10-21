import { COMMAND_GROUPS, type Command, type CommandGroup } from "./commands";

// Palette command registry (6.8). Commands navigate to the surface that owns the action: the
// dialogs live on the list pages, so "New project" opens the projects page rather than
// duplicating its dialog here. Record search is unchanged and renders below these groups.

const CREATE: Command[] = [
  {
    id: "create.deal",
    group: "Create",
    label: "New deal",
    keywords: ["deal", "pipeline", "create", "new"],
    requires: "deal.create",
    run: ({ router }) => router.push("/pipeline"),
  },
  {
    id: "create.person",
    group: "Create",
    label: "New person",
    keywords: ["person", "contact", "create", "new"],
    requires: "contact.create",
    run: ({ router }) => router.push("/contacts/people"),
  },
  {
    id: "create.organization",
    group: "Create",
    label: "New organization",
    keywords: ["organization", "company", "create", "new"],
    requires: "contact.create",
    run: ({ router }) => router.push("/contacts/orgs"),
  },
  {
    id: "create.activity",
    group: "Create",
    label: "New activity",
    keywords: ["activity", "task", "create", "new"],
    requires: "activity.create",
    run: ({ router }) => router.push("/activities/list"),
  },
  {
    id: "create.call",
    group: "Create",
    label: "Log a call",
    keywords: ["call", "log", "phone", "activity"],
    requires: "activity.create",
    run: ({ router }) => router.push("/activities/list"),
  },
  {
    id: "create.project",
    group: "Create",
    label: "New project",
    keywords: ["project", "create", "new"],
    run: ({ router }) => router.push("/projects"),
  },
  {
    id: "create.quote",
    group: "Create",
    label: "New quote",
    keywords: ["quote", "document", "invoice", "create"],
    run: ({ router }) => router.push("/documents"),
  },
];

const GO_TO: Command[] = [
  {
    id: "go.deals",
    group: "Go to",
    label: "Deals",
    keywords: ["deals", "pipeline", "board"],
    run: ({ router }) => router.push("/pipeline"),
  },
  {
    id: "go.forecast",
    group: "Go to",
    label: "Forecast",
    keywords: ["forecast", "revenue"],
    run: ({ router }) => router.push("/forecast"),
  },
  {
    id: "go.documents",
    group: "Go to",
    label: "Documents",
    keywords: ["documents", "quotes", "invoices"],
    run: ({ router }) => router.push("/documents"),
  },
  {
    id: "go.insights",
    group: "Go to",
    label: "Insights",
    keywords: ["insights", "reports", "charts"],
    run: ({ router }) => router.push("/insights"),
  },
  {
    id: "go.projects",
    group: "Go to",
    label: "Projects",
    keywords: ["projects", "tasks"],
    run: ({ router }) => router.push("/projects"),
  },
  {
    id: "go.people",
    group: "Go to",
    label: "People",
    keywords: ["people", "contacts"],
    run: ({ router }) => router.push("/contacts/people"),
  },
  {
    id: "go.organizations",
    group: "Go to",
    label: "Organizations",
    keywords: ["organizations", "companies", "contacts"],
    run: ({ router }) => router.push("/contacts/orgs"),
  },
  {
    id: "go.activities",
    group: "Go to",
    label: "Activities",
    keywords: ["activities", "tasks", "calendar"],
    run: ({ router }) => router.push("/activities/list"),
  },
  {
    id: "go.leads",
    group: "Go to",
    label: "Leads",
    keywords: ["leads", "inbox"],
    run: ({ router }) => router.push("/leads"),
  },
  {
    id: "go.inbox",
    group: "Go to",
    label: "Inbox",
    keywords: ["inbox", "email", "mail"],
    run: ({ router }) => router.push("/inbox"),
  },
  {
    id: "go.settings",
    group: "Go to",
    label: "Settings",
    keywords: ["settings", "preferences"],
    run: ({ router }) => router.push("/settings"),
  },
  {
    id: "go.api",
    group: "Go to",
    label: "API tokens",
    keywords: ["api", "tokens", "docs"],
    run: ({ router }) => router.push("/settings/api?tab=docs"),
  },
  {
    id: "go.backups",
    group: "Go to",
    label: "Backups",
    keywords: ["backups", "restore", "admin"],
    requires: "admin",
    run: ({ router }) => router.push("/settings/backups"),
  },
  {
    id: "go.audit",
    group: "Go to",
    label: "Audit log",
    keywords: ["audit", "log", "admin"],
    requires: "admin",
    run: ({ router }) => router.push("/settings/audit"),
  },
];

const ACTIONS: Command[] = [
  {
    id: "actions.duplicates",
    group: "Actions",
    label: "Find duplicates",
    keywords: ["duplicates", "merge", "contacts"],
    run: ({ router }) => router.push("/contacts/duplicates"),
  },
  {
    id: "actions.shortcuts",
    group: "Actions",
    label: "Keyboard shortcuts",
    keywords: ["shortcuts", "keyboard", "help"],
    run: () => window.dispatchEvent(new CustomEvent("warpdrive:open-shortcuts")),
  },
];

export const COMMANDS: Command[] = [...CREATE, ...GO_TO, ...ACTIONS];

export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = COMMAND_GROUPS;

export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...commands];
  return commands.filter((command) =>
    `${command.label} ${command.keywords.join(" ")}`.toLowerCase().includes(needle),
  );
}
