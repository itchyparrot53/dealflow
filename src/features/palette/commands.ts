import type { PermissionFlagKey } from "@/constants/permissionFlags";

// Palette commands (6.5). The registry itself is built in Task 3.2; this module owns the shape and
// the permission filter so the palette can drop commands an actor may not run before rendering.

export const COMMAND_GROUPS = ["Create", "Go to", "Actions"] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export interface CommandContext {
  router: { push: (href: string) => void; refresh?: () => void };
  openDialog: (id: string) => void;
}

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  keywords: string[];
  shortcut?: string;
  requires?: PermissionFlagKey | "admin";
  run: (ctx: CommandContext) => void;
}

export interface CommandActor {
  type: "admin" | "regular";
  flags: ReadonlySet<PermissionFlagKey>;
}

export function visibleCommands(all: readonly Command[], actor: CommandActor): Command[] {
  return all.filter((command) => {
    if (command.requires === undefined) return true;
    if (command.requires === "admin") return actor.type === "admin";
    return actor.flags.has(command.requires);
  });
}
