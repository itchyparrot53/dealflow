import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import type { Db } from "@/db/client";
import type { HydratedActor } from "@/server/hydrateActor";
import {
  buildAssistantCatalogue,
  READ_TOOLS,
  summarizeWrite,
  toolResultText,
  toToolDef,
  WRITE_TOOLS,
} from "./tools";

// Registration never queries: the catalogue is built from the tool registry, so a placeholder db
// and actor are enough for these assertions.
const db = {} as Db;
const actor: HydratedActor = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: null,
  type: "admin",
  isActive: true,
  groupIds: new Set<string>(),
  flags: new Set<PermissionFlagKey>(),
};

describe("assistant tool catalogue", () => {
  const catalogue = buildAssistantCatalogue(db, actor);

  it("exposes exactly the allow-listed 25 tools", () => {
    const names = catalogue.defs.map((definition) => definition.function.name).sort();
    expect(names).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
    expect(catalogue.defs).toHaveLength(25);
    expect(catalogue.kind("search")).toBe("read");
    expect(catalogue.kind("add_note")).toBe("write");
    expect(catalogue.kind("delete_email_draft")).toBeNull();
  });

  it("turns each input schema into an object JSON schema without $schema", () => {
    for (const definition of catalogue.defs) {
      const parameters = definition.function.parameters;
      expect(parameters.type).toBe("object");
      expect(parameters).not.toHaveProperty("$schema");
      expect(catalogue.schemas.get(definition.function.name)).toBeDefined();
    }
  });

  it("summarizes writes for the confirmation card", () => {
    expect(summarizeWrite("add_note", { body: "x".repeat(100) })).toBe(
      `Add note: "${"x".repeat(60)}"`,
    );
    expect(summarizeWrite("create_deal", { title: "Big deal" })).toBe('Create deal "Big deal"');
    expect(summarizeWrite("move_deal_stage", { dealId: "d1", toStageId: "s2" })).toBe(
      "Move deal d1 to stage s2",
    );
  });

  it("joins tool result text and cuts it to 8,000 characters", () => {
    const toolResult: CallToolResult = {
      content: [
        { type: "text", text: "a".repeat(5_000) },
        { type: "text", text: "b".repeat(5_000) },
      ],
    };
    expect(toolResultText(toolResult)).toHaveLength(8_000);
  });
});
