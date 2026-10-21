"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import {
  addWidget,
  createDashboard,
  type DashboardView,
  deleteDashboard,
  moveWidget,
  removeWidget,
  resizeWidget,
  updateDashboard,
} from "./dashboards";
import {
  createReport,
  deleteReport,
  duplicateReport,
  type ReportView,
  setShared,
  updateReport,
} from "./reports";

// Report and dashboard mutations. CSRF and the session live here; the services own owner-or-admin
// rules. Reads (list, get, run) are tRPC procedures in router.ts.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createReportAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<ReportView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createReport(db, g.value, input, SIG()));
}

export async function updateReportAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<ReportView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateReport(db, g.value, id, input, SIG()));
}

export async function duplicateReportAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<ReportView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await duplicateReport(db, g.value, id, SIG()));
}

export async function setReportSharedAction(
  id: string,
  shared: boolean,
  csrfToken: string | null = null,
): Promise<ActionResult<ReportView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setShared(db, g.value, id, shared, SIG()));
}

export async function deleteReportAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteReport(db, g.value, id, SIG()));
}

export async function createDashboardAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createDashboard(db, g.value, input, SIG()));
}

export async function updateDashboardAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateDashboard(db, g.value, id, input, SIG()));
}

export async function deleteDashboardAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteDashboard(db, g.value, id, SIG()));
}

export async function addWidgetAction(
  dashboardId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await addWidget(db, g.value, dashboardId, input, SIG()));
}

export async function moveWidgetAction(
  widgetId: string,
  direction: "up" | "down",
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await moveWidget(db, g.value, widgetId, direction, SIG()));
}

export async function resizeWidgetAction(
  widgetId: string,
  size: "half" | "full",
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await resizeWidget(db, g.value, widgetId, size, SIG()));
}

export async function removeWidgetAction(
  widgetId: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DashboardView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await removeWidget(db, g.value, widgetId, SIG()));
}
