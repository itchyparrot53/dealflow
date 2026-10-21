import { and, count, eq, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { EXPORT_MAX_ROWS } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { deals, documents, pipelines } from "@/db/schema";
import { listActivityRows } from "@/features/activities/activityRows";
import { listPeople } from "@/features/contacts/listPeople";
import { listOrgs } from "@/features/contacts/orgsRepo";
import type { ContactActor } from "@/features/contacts/personsRepo";
import { listDeals } from "@/features/deals/dealRepo";
import { dealVisibilityClause } from "@/features/deals/visibility";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { listProducts } from "@/features/products/products";
import { err, ok, type Result } from "@/types/result";
import type { CsvCell } from "./csv";

// CSV export of the six main lists (6.8). Each loader calls the list's own query or the same
// visibility predicate, then the route streams the chosen columns through csvStream. The gate,
// the row cap and the formula guard are the only behaviour added on top of the list.

export const EXPORT_ENTITIES = [
  "deals",
  "persons",
  "organizations",
  "activities",
  "products",
  "invoices",
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export interface ExportColumn {
  key: string;
  header: string;
  value: (row: Record<string, unknown>) => CsvCell;
}

export interface ExportTable {
  header: string[];
  rows: CsvCell[][];
  filename: string;
}

function field(row: Record<string, unknown>, key: string): CsvCell {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  return JSON.stringify(value);
}

function isoOrEmpty(row: Record<string, unknown>, key: string): CsvCell {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const DEAL_COLUMNS: ExportColumn[] = [
  { key: "title", header: "Title", value: (row) => field(row, "title") },
  { key: "status", header: "Status", value: (row) => field(row, "status") },
  { key: "value", header: "Value", value: (row) => field(row, "value") },
  { key: "currency", header: "Currency", value: (row) => field(row, "currency") },
  { key: "ownerName", header: "Owner", value: (row) => field(row, "ownerName") },
  { key: "stageName", header: "Stage", value: (row) => field(row, "stageName") },
  { key: "personName", header: "Person", value: (row) => field(row, "personName") },
  { key: "orgName", header: "Organization", value: (row) => field(row, "orgName") },
  {
    key: "expectedCloseDate",
    header: "Expected close",
    value: (row) => field(row, "expectedCloseDate"),
  },
  { key: "updatedAt", header: "Updated", value: (row) => isoOrEmpty(row, "updatedAt") },
];

const PERSON_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Name", value: (row) => field(row, "name") },
  { key: "primaryEmail", header: "Email", value: (row) => field(row, "primaryEmail") },
  {
    key: "phone",
    header: "Phone",
    value: (row) => {
      const phones = row.phones;
      if (!Array.isArray(phones) || phones.length === 0) return null;
      const first = phones[0] as { value?: unknown };
      return typeof first.value === "string" ? first.value : null;
    },
  },
  { key: "orgName", header: "Organization", value: (row) => field(row, "orgName") },
  { key: "updatedAt", header: "Updated", value: (row) => isoOrEmpty(row, "updatedAt") },
];

const ORG_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Name", value: (row) => field(row, "name") },
  { key: "domain", header: "Domain", value: (row) => field(row, "domain") },
  { key: "updatedAt", header: "Updated", value: (row) => isoOrEmpty(row, "updatedAt") },
];

const ACTIVITY_COLUMNS: ExportColumn[] = [
  { key: "subject", header: "Subject", value: (row) => field(row, "subject") },
  { key: "typeKey", header: "Type", value: (row) => field(row, "typeKey") },
  { key: "done", header: "Done", value: (row) => (row.done === true ? "yes" : "no") },
  { key: "dueAt", header: "Due", value: (row) => field(row, "dueAtIso") },
  { key: "assigneeName", header: "Assignee", value: (row) => field(row, "assigneeName") },
  { key: "dealTitle", header: "Deal", value: (row) => field(row, "dealTitle") },
];

const PRODUCT_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Name", value: (row) => field(row, "name") },
  { key: "code", header: "Code", value: (row) => field(row, "code") },
  { key: "unit", header: "Unit", value: (row) => field(row, "unit") },
  { key: "price", header: "Price", value: (row) => field(row, "price") },
  { key: "currency", header: "Currency", value: (row) => field(row, "currency") },
  { key: "taxPercent", header: "Tax %", value: (row) => field(row, "taxPercent") },
  { key: "active", header: "Active", value: (row) => (row.active === true ? "yes" : "no") },
];

const INVOICE_COLUMNS: ExportColumn[] = [
  { key: "number", header: "Number", value: (row) => field(row, "number") },
  { key: "title", header: "Title", value: (row) => field(row, "title") },
  { key: "status", header: "Status", value: (row) => field(row, "status") },
  { key: "total", header: "Total", value: (row) => field(row, "total") },
  { key: "currency", header: "Currency", value: (row) => field(row, "currency") },
  { key: "dueDate", header: "Due", value: (row) => field(row, "dueDate") },
  { key: "customerName", header: "Customer", value: (row) => field(row, "customerName") },
];

const COLUMNS: Record<ExportEntity, ExportColumn[]> = {
  deals: DEAL_COLUMNS,
  persons: PERSON_COLUMNS,
  organizations: ORG_COLUMNS,
  activities: ACTIVITY_COLUMNS,
  products: PRODUCT_COLUMNS,
  invoices: INVOICE_COLUMNS,
};

export function isExportEntity(value: string): value is ExportEntity {
  return (EXPORT_ENTITIES as readonly string[]).includes(value);
}

function selectedColumns(entity: ExportEntity, raw: string | undefined): ExportColumn[] {
  const all = COLUMNS[entity];
  if (raw === undefined || raw === "") return all;
  const keys = raw.split(",").map((key) => key.trim());
  const chosen = all.filter((column) => keys.includes(column.key));
  return chosen.length === 0 ? all : chosen;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function filterRows(
  entity: ExportEntity,
  rows: Record<string, unknown>[],
  params: Record<string, string>,
): Record<string, unknown>[] {
  const search = params.search?.toLowerCase() ?? "";
  const by = (key: string, param: string): Record<string, unknown>[] => {
    const wanted = params[param];
    if (wanted === undefined || wanted === "") return rows;
    return rows.filter((row) => text(row, key) === wanted);
  };
  let filtered = rows;
  if (search !== "") {
    filtered = filtered.filter(
      (row) =>
        text(row, "title").toLowerCase().includes(search) ||
        text(row, "name").toLowerCase().includes(search) ||
        text(row, "subject").toLowerCase().includes(search) ||
        text(row, "primaryEmail").toLowerCase().includes(search),
    );
  }
  if (entity === "deals") {
    filtered = by("status", "status");
    filtered = by("ownerId", "ownerId");
    filtered = by("stageId", "stageId");
  } else if (entity === "persons") {
    filtered = by("orgId", "organizationId");
  } else if (entity === "activities") {
    filtered = by("dealId", "dealId");
    filtered = by("personId", "personId");
    filtered = by("assigneeId", "assigneeId");
    const done = params.done;
    if (done !== undefined && done !== "") {
      filtered = filtered.filter((row) => row.done === (done === "true"));
    }
    filtered = by("typeKey", "typeKey");
  } else if (entity === "products") {
    const active = params.active;
    if (active !== undefined && active !== "") {
      filtered = filtered.filter((row) => row.active === (active === "true"));
    }
  } else if (entity === "invoices") {
    filtered = by("status", "status");
  }
  return filtered;
}

function tooLarge(): AppError {
  return new AppError(ERROR_IDS.EXPORT_TOO_LARGE, "export is larger than the row cap");
}

function filenameFor(entity: ExportEntity): string {
  return `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function contactSession(actor: PermSetUser): ContactActor {
  return { ...actor, primaryVisibilityGroupId: null };
}

async function dealRows(
  db: Db,
  actor: PermSetUser,
  params: Record<string, string>,
  cap: number,
  signal: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const result = await listDeals(
    db,
    {
      userId: actor.id,
      isAdmin: actor.type === "admin",
      isActive: actor.isActive,
      sessionLive: true,
      visibilityGroupIds: Array.from(actor.groupIds),
      managedUserIds: Array.from(actor.managedUserIds ?? []),
    },
    {
      offset: 0,
      limit: cap + 1,
      ...(params.pipelineId === undefined ? {} : { pipelineId: params.pipelineId }),
    },
    signal,
  );
  if (result.total > cap) throw tooLarge();
  return result.rows as unknown as Record<string, unknown>[];
}

async function apiRows(
  db: Db,
  actor: PermSetUser,
  entity: ExportEntity,
  params: Record<string, string>,
  cap: number,
  signal: AbortSignal,
): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case "deals":
      // Handled by dealRows before this function; listed so the switch stays exhaustive.
      return [];
    case "persons": {
      const result = await listPeople(
        db,
        contactSession(actor),
        { offset: 0, limit: cap + 1 },
        signal,
      );
      if (result.total > cap) throw tooLarge();
      return result.rows;
    }
    case "organizations": {
      const result = await listOrgs(
        db,
        contactSession(actor),
        { offset: 0, limit: cap + 1 },
        signal,
      );
      if (result.total > cap) throw tooLarge();
      return result.rows as unknown as Record<string, unknown>[];
    }
    case "activities": {
      const result = await listActivityRows(
        db,
        actor,
        {
          ownerId: null,
          done: "all",
          from: null,
          to: null,
          typeKey: null,
        },
        signal,
      );
      if (result.length > cap) throw tooLarge();
      return result as unknown as Record<string, unknown>[];
    }
    case "products": {
      const result = await listProducts(db, { includeInactive: true }, signal);
      if (result.length > cap) throw tooLarge();
      return result;
    }
    case "invoices": {
      const visibility = dealVisibilityClause({
        userId: actor.id,
        isAdmin: actor.type === "admin",
        isActive: actor.isActive,
        sessionLive: true,
        visibilityGroupIds: Array.from(actor.groupIds),
        managedUserIds: Array.from(actor.managedUserIds ?? []),
      });
      const [totalRow] = await db
        .select({ value: count() })
        .from(documents)
        .innerJoin(deals, eq(deals.id, documents.dealId))
        .innerJoin(pipelines, eq(pipelines.id, deals.pipelineId))
        .where(
          and(
            eq(documents.kind, "invoice"),
            isNull(deals.deletedAt),
            eq(pipelines.isArchived, false),
            visibility,
          ),
        );
      const total = totalRow?.value ?? 0;
      if (total > cap) throw tooLarge();
      return db
        .select({
          number: documents.number,
          title: documents.title,
          status: documents.status,
          total: documents.total,
          currency: documents.currency,
          dueDate: documents.dueDate,
          customerName: documents.customerName,
        })
        .from(documents)
        .innerJoin(deals, eq(deals.id, documents.dealId))
        .innerJoin(pipelines, eq(pipelines.id, deals.pipelineId))
        .where(
          and(
            eq(documents.kind, "invoice"),
            isNull(deals.deletedAt),
            eq(pipelines.isArchived, false),
            visibility,
          ),
        );
    }
    default:
      return [];
  }
}

export async function exportTable(
  db: Db,
  actor: PermSetUser,
  entity: string,
  params: Record<string, string>,
  signal: AbortSignal,
  cap: number = EXPORT_MAX_ROWS,
): Promise<Result<ExportTable, AppError>> {
  if (!isExportEntity(entity)) {
    return err(new AppError(ERROR_IDS.EXPORT_FORBIDDEN, "unknown export entity", { entity }));
  }
  if (!can(actor, "data.export")) {
    return err(new AppError(ERROR_IDS.EXPORT_FORBIDDEN, "data.export required", {}));
  }
  signal.throwIfAborted();
  try {
    const rows =
      entity === "deals"
        ? await dealRows(db, actor, params, cap, signal)
        : await apiRows(db, actor, entity, params, cap, signal);
    const columns = selectedColumns(entity, params.columns);
    const filtered = filterRows(entity, rows, params);
    return ok({
      header: columns.map((column) => column.header),
      rows: filtered.map((row) => columns.map((column) => column.value(row))),
      filename: filenameFor(entity),
    });
  } catch (error) {
    if (error instanceof AppError) return err(error);
    throw error;
  }
}
