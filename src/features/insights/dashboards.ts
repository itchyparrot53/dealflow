import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { dashboards, dashboardWidgets, goals, reports, users } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// Dashboards arrange reports and goals into widgets. Reads omit a report widget the viewer may
// not read, so a shared dashboard can never leak a private report's numbers. Only the owner or
// an admin changes a dashboard or its widgets.

export interface DashboardWidgetView {
  id: string;
  kind: "report" | "goal";
  reportId: string | null;
  goalId: string | null;
  size: "half" | "full";
  position: number;
}

export interface DashboardView {
  id: string;
  name: string;
  shared: boolean;
  isDefault: boolean;
  ownerId: string;
  ownerName: string;
  widgets: DashboardWidgetView[];
  createdAt: string;
  updatedAt: string;
}

type DashboardRow = typeof dashboards.$inferSelect;
type WidgetRow = typeof dashboardWidgets.$inferSelect;

const dashboardWrite = z.object({
  name: z.string().min(1).max(120),
  shared: z.boolean().optional(),
});
export const createDashboardInput = dashboardWrite;
export const updateDashboardInput = dashboardWrite.partial();

export const addWidgetInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("report"),
    reportId: z.uuid(),
    size: z.enum(["half", "full"]).optional(),
  }),
  z.object({
    kind: z.literal("goal"),
    goalId: z.uuid(),
    size: z.enum(["half", "full"]).optional(),
  }),
]);

function canEdit(actor: PermSetUser, ownerId: string): boolean {
  return actor.type === "admin" || actor.id === ownerId;
}

function notFound(): AppError {
  return new AppError(ERROR_IDS.INSIGHT_NOT_FOUND, "dashboard not found or not readable");
}

function forbidden(): AppError {
  return new AppError(ERROR_IDS.INSIGHT_FORBIDDEN, "only the owner or an admin can change this");
}

function invalidInput(issues: unknown): AppError {
  return new AppError(ERROR_IDS.INSIGHT_INPUT_INVALID, "invalid dashboard input", { issues });
}

function widgetView(row: WidgetRow): DashboardWidgetView {
  return {
    id: row.id,
    kind: row.kind === "goal" ? "goal" : "report",
    reportId: row.reportId,
    goalId: row.goalId,
    size: row.size === "full" ? "full" : "half",
    position: row.position,
  };
}

function dashboardView(row: DashboardRow, ownerName: string, widgets: WidgetRow[]): DashboardView {
  return {
    id: row.id,
    name: row.name,
    shared: row.shared,
    isDefault: row.isDefault,
    ownerId: row.ownerId,
    ownerName,
    widgets: widgets.map(widgetView),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadWidgets(db: Db, actor: PermSetUser, dashboardId: string): Promise<WidgetRow[]> {
  const rows = await db
    .select({
      widget: dashboardWidgets,
      reportShared: reports.shared,
      reportOwnerId: reports.ownerId,
      goalDeletedAt: goals.deletedAt,
    })
    .from(dashboardWidgets)
    .leftJoin(reports, eq(reports.id, dashboardWidgets.reportId))
    .leftJoin(goals, eq(goals.id, dashboardWidgets.goalId))
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .orderBy(asc(dashboardWidgets.position));

  return rows
    .filter((row) => {
      if (row.widget.kind === "report") {
        if (row.reportOwnerId === null) return false;
        return row.reportShared === true || canEdit(actor, row.reportOwnerId);
      }
      return row.goalDeletedAt === null && row.widget.goalId !== null;
    })
    .map((row) => row.widget);
}

export async function listDashboards(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<DashboardView[]> {
  signal.throwIfAborted();
  const rows = await db
    .select({ dashboard: dashboards, ownerName: users.name })
    .from(dashboards)
    .leftJoin(users, eq(users.id, dashboards.ownerId))
    .where(
      actor.type === "admin"
        ? undefined
        : or(eq(dashboards.ownerId, actor.id), eq(dashboards.shared, true)),
    )
    .orderBy(asc(dashboards.isDefault), asc(dashboards.name));
  signal.throwIfAborted();
  return Promise.all(
    rows.map(async (row) =>
      dashboardView(
        row.dashboard,
        row.ownerName ?? row.dashboard.ownerId,
        await loadWidgets(db, actor, row.dashboard.id),
      ),
    ),
  );
}

export async function getDashboard(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ dashboard: dashboards, ownerName: users.name })
    .from(dashboards)
    .leftJoin(users, eq(users.id, dashboards.ownerId))
    .where(eq(dashboards.id, id))
    .limit(1);
  if (row === undefined) return err(notFound());
  if (!row.dashboard.shared && !canEdit(actor, row.dashboard.ownerId)) return err(notFound());
  const widgets = await loadWidgets(db, actor, id);
  signal.throwIfAborted();
  return ok(dashboardView(row.dashboard, row.ownerName ?? row.dashboard.ownerId, widgets));
}

export async function createDashboard(
  db: Db,
  actor: PermSetUser,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const parsed = createDashboardInput.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  signal.throwIfAborted();
  const [row] = await db
    .insert(dashboards)
    .values({
      name: parsed.data.name,
      shared: parsed.data.shared ?? false,
      ownerId: actor.id,
    })
    .returning({ id: dashboards.id });
  if (row === undefined) return err(notFound());
  return ok(await reload(db, actor, row.id, signal));
}

async function reload(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<DashboardView> {
  const [row] = await db
    .select({ dashboard: dashboards, ownerName: users.name })
    .from(dashboards)
    .leftJoin(users, eq(users.id, dashboards.ownerId))
    .where(eq(dashboards.id, id))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.INSIGHT_NOT_FOUND, "dashboard vanished after write", { id });
  }
  return dashboardView(
    row.dashboard,
    row.ownerName ?? row.dashboard.ownerId,
    await loadWidgets(db, actor, id),
  );
}

async function ownedDashboard(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<DashboardRow, AppError>> {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, id)).limit(1);
  signal.throwIfAborted();
  if (row === undefined) return err(notFound());
  if (!canEdit(actor, row.ownerId)) return err(forbidden());
  return ok(row);
}

export async function updateDashboard(
  db: Db,
  actor: PermSetUser,
  id: string,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const parsed = updateDashboardInput.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  const owned = await ownedDashboard(db, actor, id, signal);
  if (!owned.ok) return owned;
  await db
    .update(dashboards)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.shared === undefined ? {} : { shared: parsed.data.shared }),
      updatedAt: new Date(),
    })
    .where(eq(dashboards.id, id));
  return ok(await reload(db, actor, id, signal));
}

export async function deleteDashboard(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  const owned = await ownedDashboard(db, actor, id, signal);
  if (!owned.ok) return owned;
  await db.delete(dashboards).where(eq(dashboards.id, id));
  return ok(undefined);
}

export async function addWidget(
  db: Db,
  actor: PermSetUser,
  dashboardId: string,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const parsed = addWidgetInput.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  const owned = await ownedDashboard(db, actor, dashboardId, signal);
  if (!owned.ok) return owned;

  if (parsed.data.kind === "report") {
    const [reportRow] = await db
      .select({ shared: reports.shared, ownerId: reports.ownerId })
      .from(reports)
      .where(eq(reports.id, parsed.data.reportId))
      .limit(1);
    if (reportRow === undefined) return err(notFound());
    if (!reportRow.shared && !canEdit(actor, reportRow.ownerId)) return err(notFound());
  } else {
    const [goalRow] = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, parsed.data.goalId), isNull(goals.deletedAt)))
      .limit(1);
    if (goalRow === undefined) return err(notFound());
  }

  const siblings = await db
    .select({ position: dashboardWidgets.position })
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId));
  const nextPosition = siblings.reduce((max, row) => Math.max(max, row.position + 1), 0);

  await db.insert(dashboardWidgets).values({
    dashboardId,
    position: nextPosition,
    kind: parsed.data.kind,
    reportId: parsed.data.kind === "report" ? parsed.data.reportId : null,
    goalId: parsed.data.kind === "goal" ? parsed.data.goalId : null,
    size: parsed.data.size ?? "half",
  });
  return ok(await reload(db, actor, dashboardId, signal));
}

async function widgetForEdit(
  db: Db,
  actor: PermSetUser,
  widgetId: string,
  signal: AbortSignal,
): Promise<Result<WidgetRow, AppError>> {
  const [row] = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.id, widgetId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) return err(notFound());
  const owned = await ownedDashboard(db, actor, row.dashboardId, signal);
  if (!owned.ok) return owned;
  return ok(row);
}

export async function moveWidget(
  db: Db,
  actor: PermSetUser,
  widgetId: string,
  direction: "up" | "down",
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const widget = await widgetForEdit(db, actor, widgetId, signal);
  if (!widget.ok) return widget;
  const siblings = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, widget.value.dashboardId))
    .orderBy(asc(dashboardWidgets.position));
  const index = siblings.findIndex((row) => row.id === widgetId);
  const target = direction === "up" ? index - 1 : index + 1;
  const neighbour = siblings[target];
  if (index < 0 || neighbour === undefined) {
    return ok(await reload(db, actor, widget.value.dashboardId, signal));
  }

  await db.transaction(async (tx) => {
    await tx
      .update(dashboardWidgets)
      .set({ position: neighbour.position })
      .where(eq(dashboardWidgets.id, widget.value.id));
    await tx
      .update(dashboardWidgets)
      .set({ position: widget.value.position })
      .where(eq(dashboardWidgets.id, neighbour.id));
  });
  return ok(await reload(db, actor, widget.value.dashboardId, signal));
}

export async function resizeWidget(
  db: Db,
  actor: PermSetUser,
  widgetId: string,
  size: "half" | "full",
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const widget = await widgetForEdit(db, actor, widgetId, signal);
  if (!widget.ok) return widget;
  await db.update(dashboardWidgets).set({ size }).where(eq(dashboardWidgets.id, widgetId));
  return ok(await reload(db, actor, widget.value.dashboardId, signal));
}

export async function removeWidget(
  db: Db,
  actor: PermSetUser,
  widgetId: string,
  signal: AbortSignal,
): Promise<Result<DashboardView, AppError>> {
  const widget = await widgetForEdit(db, actor, widgetId, signal);
  if (!widget.ok) return widget;
  await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, widgetId));
  return ok(await reload(db, actor, widget.value.dashboardId, signal));
}
