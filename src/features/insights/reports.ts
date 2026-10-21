import { asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { reports, users } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { type ReportDefinition, reportDefinitionSchema } from "./definition";

// Saved report definitions. Any user creates their own; only the owner or an admin edits or
// deletes one; a shared report is readable by every signed-in user. Mutations arrive through
// server actions, reads through the insights router.

export interface ReportView {
  id: string;
  name: string;
  description: string | null;
  definition: ReportDefinition;
  shared: boolean;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

const reportWrite = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  definition: reportDefinitionSchema,
  shared: z.boolean().optional(),
});

export const createReportInput = reportWrite;
export const updateReportInput = reportWrite.partial();

type ReportRow = typeof reports.$inferSelect;

function canEdit(actor: PermSetUser, ownerId: string): boolean {
  return actor.type === "admin" || actor.id === ownerId;
}

function view(row: ReportRow, ownerName: string): ReportView {
  const parsed = reportDefinitionSchema.safeParse(row.definition);
  if (!parsed.success) {
    // Only a corrupt row can get here: every write validates first.
    throw new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "stored definition is invalid", {
      reportId: row.id,
      issues: parsed.error.issues,
    });
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    definition: parsed.data,
    shared: row.shared,
    ownerId: row.ownerId,
    ownerName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const withOwner = (db: Db) =>
  db
    .select({ report: reports, ownerName: users.name })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.ownerId));

function invalidInput(issues: unknown): AppError {
  return new AppError(ERROR_IDS.INSIGHT_INPUT_INVALID, "invalid report input", { issues });
}

function notFound(): AppError {
  return new AppError(ERROR_IDS.INSIGHT_NOT_FOUND, "report not found or not readable");
}

function forbidden(): AppError {
  return new AppError(ERROR_IDS.INSIGHT_FORBIDDEN, "only the owner or an admin can change this");
}

export async function listReports(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<ReportView[]> {
  signal.throwIfAborted();
  const rows = await withOwner(db)
    .where(
      actor.type === "admin"
        ? undefined
        : or(eq(reports.ownerId, actor.id), eq(reports.shared, true)),
    )
    .orderBy(asc(reports.name));
  signal.throwIfAborted();
  return rows.map((row) => view(row.report, row.ownerName ?? row.report.ownerId));
}

export async function getReport(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<ReportView, AppError>> {
  signal.throwIfAborted();
  const rows = await withOwner(db).where(eq(reports.id, id)).limit(1);
  signal.throwIfAborted();
  const row = rows[0];
  if (row === undefined) return err(notFound());
  if (!row.report.shared && !canEdit(actor, row.report.ownerId)) return err(notFound());
  return ok(view(row.report, row.ownerName ?? row.report.ownerId));
}

async function reload(db: Db, id: string, signal: AbortSignal): Promise<ReportView> {
  const rows = await withOwner(db).where(eq(reports.id, id)).limit(1);
  signal.throwIfAborted();
  const row = rows[0];
  if (row === undefined) {
    throw new AppError(ERROR_IDS.INSIGHT_NOT_FOUND, "report vanished after write", { id });
  }
  return view(row.report, row.ownerName ?? row.report.ownerId);
}

export async function createReport(
  db: Db,
  actor: PermSetUser,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<ReportView, AppError>> {
  const parsed = createReportInput.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  signal.throwIfAborted();
  const [row] = await db
    .insert(reports)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition,
      shared: parsed.data.shared ?? false,
      ownerId: actor.id,
    })
    .returning({ id: reports.id });
  if (row === undefined) return err(notFound());
  return ok(await reload(db, row.id, signal));
}

export async function updateReport(
  db: Db,
  actor: PermSetUser,
  id: string,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<ReportView, AppError>> {
  const parsed = updateReportInput.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  signal.throwIfAborted();
  const [existing] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (existing === undefined) return err(notFound());
  if (!canEdit(actor, existing.ownerId)) return err(forbidden());

  const patch = parsed.data;
  await db
    .update(reports)
    .set({
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.description === undefined ? {} : { description: patch.description }),
      ...(patch.definition === undefined ? {} : { definition: patch.definition }),
      ...(patch.shared === undefined ? {} : { shared: patch.shared }),
      updatedAt: new Date(),
    })
    .where(eq(reports.id, id));
  return ok(await reload(db, id, signal));
}

export async function duplicateReport(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<ReportView, AppError>> {
  const source = await getReport(db, actor, id, signal);
  if (!source.ok) return source;
  signal.throwIfAborted();
  const base = source.value.name.slice(0, 110);
  return createReport(
    db,
    actor,
    {
      name: `${base} (copy)`,
      description: source.value.description,
      definition: source.value.definition,
      // A copy starts private: sharing is a separate decision the new owner makes.
      shared: false,
    },
    signal,
  );
}

export async function setShared(
  db: Db,
  actor: PermSetUser,
  id: string,
  shared: boolean,
  signal: AbortSignal,
): Promise<Result<ReportView, AppError>> {
  return updateReport(db, actor, id, { shared }, signal);
}

export async function deleteReport(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  const [existing] = await db
    .select({ ownerId: reports.ownerId })
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  if (existing === undefined) return err(notFound());
  if (!canEdit(actor, existing.ownerId)) return err(forbidden());
  await db.delete(reports).where(eq(reports.id, id));
  return ok(undefined);
}
