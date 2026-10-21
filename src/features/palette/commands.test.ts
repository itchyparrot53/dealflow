import { describe, expect, test } from "vitest";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { type Command, type CommandActor, visibleCommands } from "./commands";

const noop = (): void => undefined;

const commands: Command[] = [
  {
    id: "create.deal",
    group: "Create",
    label: "New deal",
    keywords: ["deal", "new"],
    requires: "deal.create",
    run: noop,
  },
  {
    id: "go.settings.api",
    group: "Go to",
    label: "API settings",
    keywords: ["api"],
    requires: "admin",
    run: noop,
  },
  {
    id: "go.deals",
    group: "Go to",
    label: "Deals",
    keywords: ["deals"],
    run: noop,
  },
];

function actor(type: CommandActor["type"], flags: PermissionFlagKey[] = []): CommandActor {
  return { type, flags: new Set(flags) };
}

describe("visibleCommands", () => {
  test("hides admin commands from a regular user", () => {
    expect(visibleCommands(commands, actor("member", ["deal.create"])).map((c) => c.id)).toEqual([
      "create.deal",
      "go.deals",
    ]);
  });

  test("shows admin commands to an admin", () => {
    expect(visibleCommands(commands, actor("admin")).map((c) => c.id)).toEqual([
      "go.settings.api",
      "go.deals",
    ]);
  });

  test("hides commands whose flag the actor lacks", () => {
    expect(visibleCommands(commands, actor("member")).map((c) => c.id)).toEqual(["go.deals"]);
  });

  test("keeps commands that require nothing", () => {
    expect(visibleCommands(commands, actor("member")).some((c) => c.id === "go.deals")).toBe(true);
  });
});
