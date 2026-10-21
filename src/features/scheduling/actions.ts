"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import {
  type BookingPage,
  createPage,
  deletePage,
  setPageActive,
  updatePage,
} from "./bookingPages";

// Booking-page actions. CSRF and the session live here; the service owns the owner-or-admin rule.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createBookingPageAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<BookingPage>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createPage(db, g.value, input, SIG()));
}

export async function updateBookingPageAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<BookingPage>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updatePage(db, g.value, id, input, SIG()));
}

export async function setBookingPageActiveAction(
  id: string,
  active: boolean,
  csrfToken: string | null = null,
): Promise<ActionResult<BookingPage>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setPageActive(db, g.value, id, active, SIG()));
}

export async function deleteBookingPageAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deletePage(db, g.value, id, SIG()));
}
