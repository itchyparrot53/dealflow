import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Db } from "@/db/client";
import { buildAppContext } from "@/features/mcp/actorContext";
import { registerReadTools } from "@/features/mcp/tools/reads";
import type { ToolDefinition, ToolRegistry } from "@/features/mcp/tools/types";
import { registerWriteTools } from "@/features/mcp/tools/writes";
import type { HydratedActor } from "@/server/hydrateActor";
import type { AiToolDef } from "../types";

// The assistant may use exactly these registered MCP tools: the same handlers, permission checks
// and visibility rules as external MCP clients, through a deliberately small allow-list.
export const READ_TOOLS = [
  "search",
  "list_deals",
  "get_deal",
  "list_leads",
  "get_lead",
  "list_persons",
  "get_person",
  "list_organizations",
  "get_organization",
  "list_activities",
  "list_pipelines",
  "pipeline_summary",
] as const;

export const WRITE_TOOLS = [
  "create_activity",
  "update_activity",
  "complete_activity",
  "add_note",
  "create_person",
  "update_person",
  "create_organization",
  "update_organization",
  "create_deal",
  "update_deal",
  "move_deal_stage",
  "create_lead",
  "convert_lead_to_deal",
] as const;

export interface AssistantCatalogue {
  defs: AiToolDef[];
  reads: ToolRegistry;
  writes: ToolRegistry;
  schemas: Map<string, z.ZodObject>;
  kind(name: string): "read" | "write" | null;
}

export function toToolDef(name: string, definition: ToolDefinition): AiToolDef {
  const parameters = z.toJSONSchema(definition.inputSchema, {
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete parameters.$schema;
  return {
    type: "function",
    function: { name, description: definition.description, parameters },
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function firstId(args: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function summarizeWrite(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "create_activity":
      return `Create activity "${str(args.subject)}"`;
    case "update_activity":
      return `Update activity ${firstId(args, ["id"])}`;
    case "complete_activity":
      return `Mark activity ${firstId(args, ["id"])} as ${args.done === true ? "done" : "not done"}`;
    case "add_note":
      return `Add note: "${str(args.body).slice(0, 60)}"`;
    case "create_person":
      return `Create person "${str(args.name)}"`;
    case "create_organization":
      return `Create organization "${str(args.name)}"`;
    case "update_person":
      return `Update person ${firstId(args, ["id"])}`;
    case "update_organization":
      return `Update organization ${firstId(args, ["id"])}`;
    case "create_deal":
      return `Create deal "${str(args.title)}"`;
    case "update_deal":
      return `Update deal ${firstId(args, ["dealId", "id"])}`;
    case "move_deal_stage":
      return `Move deal ${firstId(args, ["dealId"])} to stage ${firstId(args, ["toStageId"])}`;
    case "create_lead":
      return `Create lead "${str(args.title)}"`;
    case "convert_lead_to_deal":
      return `Convert lead ${firstId(args, ["leadId", "id"])} to a deal`;
    default:
      return `${name} ${JSON.stringify(args).slice(0, 80)}`;
  }
}

export function toolResultText(result: CallToolResult): string {
  const text = result.content
    .map((item) => (item.type === "text" ? item.text : ""))
    .filter((value) => value !== "")
    .join("\n");
  return text.slice(0, 8_000);
}

export function buildAssistantCatalogue(db: Db, actor: HydratedActor): AssistantCatalogue {
  const server: McpServer = new McpServer({ name: "dealflow-assistant", version: "1.0.0" });
  const getCtx = () => buildAppContext(db, actor);
  const reads = registerReadTools(server, getCtx);
  const writes = registerWriteTools(server, getCtx, db);

  const defs: AiToolDef[] = [];
  const schemas = new Map<string, z.ZodObject>();
  for (const name of [...READ_TOOLS, ...WRITE_TOOLS]) {
    const definition = reads.definitions.get(name) ?? writes.definitions.get(name);
    if (definition === undefined) continue;
    defs.push(toToolDef(name, definition));
    schemas.set(name, definition.inputSchema);
  }

  return {
    defs,
    reads,
    writes,
    schemas,
    kind: (name) => {
      if ((READ_TOOLS as readonly string[]).includes(name)) return "read";
      if ((WRITE_TOOLS as readonly string[]).includes(name)) return "write";
      return null;
    },
  };
}
