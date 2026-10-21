import { SHORTCUT_SEQUENCE_MS } from "@/constants/productivity";

// One registry drives both the matcher and the help sheet (6.8), so a shortcut cannot exist in one
// place and be missing from the other. Create sequences navigate to the list page that owns the
// create dialog, matching the palette's Create commands.

export interface ShortcutSequence {
  keys: string;
  label: string;
  href: string;
}

export const SHORTCUT_SEQUENCES: readonly ShortcutSequence[] = [
  { keys: "g d", label: "Deals", href: "/pipeline" },
  { keys: "g p", label: "People", href: "/contacts/people" },
  { keys: "g o", label: "Organizations", href: "/contacts/orgs" },
  { keys: "g a", label: "Activities", href: "/activities/list" },
  { keys: "g l", label: "Leads", href: "/leads" },
  { keys: "g i", label: "Insights", href: "/insights" },
  { keys: "g j", label: "Projects", href: "/projects" },
  { keys: "g f", label: "Forecast", href: "/forecast" },
  { keys: "g m", label: "Inbox", href: "/inbox" },
  { keys: "n d", label: "New deal", href: "/pipeline" },
  { keys: "n p", label: "New person", href: "/contacts/people" },
  { keys: "n o", label: "New organization", href: "/contacts/orgs" },
  { keys: "n a", label: "New activity", href: "/activities/list" },
  { keys: "n c", label: "Log a call", href: "/activities/list" },
];

export const SEQUENCE_MAP: Record<string, string> = Object.fromEntries(
  SHORTCUT_SEQUENCES.map((sequence) => [sequence.keys, sequence.href]),
);

export const SEQUENCE_TIMEOUT_MS = SHORTCUT_SEQUENCE_MS;

export interface ShortcutHelpGroup {
  title: string;
  items: { keys: string; label: string }[];
}

export const SHORTCUT_HELP_GROUPS: readonly ShortcutHelpGroup[] = [
  {
    title: "Navigation",
    items: SHORTCUT_SEQUENCES.filter((sequence) => sequence.keys.startsWith("g ")).map(
      (sequence) => ({ keys: sequence.keys, label: sequence.label }),
    ),
  },
  {
    title: "Create",
    items: SHORTCUT_SEQUENCES.filter((sequence) => sequence.keys.startsWith("n ")).map(
      (sequence) => ({ keys: sequence.keys, label: sequence.label }),
    ),
  },
  {
    title: "Lists",
    items: [
      { keys: "j / k", label: "Move the row cursor" },
      { keys: "Enter", label: "Open the row under the cursor" },
      { keys: "1-9", label: "Jump to a navigation item" },
      { keys: "Escape", label: "Close a dialog or the palette" },
    ],
  },
  {
    title: "Palette",
    items: [
      { keys: "Cmd/Ctrl+K", label: "Open the command palette" },
      { keys: "?", label: "Open this shortcut sheet" },
    ],
  },
];
