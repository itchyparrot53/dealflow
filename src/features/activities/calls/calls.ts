import { and, asc, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { CallDirection, CallOutcome } from "@/constants/productivity";
import { CALL_DIRECTIONS, CALL_OUTCOMES } from "@/constants/productivity";
import { CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS } from "@/constants/productivityStrings";
import type { Db } from "@/db/client";
import { activityTypes } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { createActivity } from "../repo";

// Call logging (6.6). A call is a normal done activity of the install's call type plus one
// activity_calls side row, so the timeline, search and permissions paths need no special case.

export interface CallMeta {
  outcome: CallOutcome;
  direction: CallDirection;
  durationSeconds: number | null;
}

export const callInputSchema = z
  .object({
    dealId: z.string().uuid().nullish(),
    personId: z.string().uuid().nullish(),
    organizationId: z.string().uuid().nullish(),
    outcome: z.enum(CALL_OUTCOMES),
    direction: z.enum(CALL_DIRECTIONS),
    durationSeconds: z.number().int().min(0).max(86_400).nullish(),
    note: z.string().max(20_000).nullish(),
    at: z.string().datetime().nullish(),
  })
  .strict();

export type CallInput = z.infer<typeof callInputSchema>;

// The install's call type: the first active type whose key or name mentions "call". The seeded
// catalog has one (key "call"); a rename keeps finding it, and an absent one is E_CALL_001.
export async function resolveCallType(db: Db, signal: AbortSignal) {
  const [type] = await db
    .select()
    .from(activityTypes)
    .where(
      and(
        isNull(activityTypes.archivedAt),
        or(
          sql`lower(${activityTypes.key}) like '%call%'`,
          sql`lower(${activityTypes.name}) like '%call%'`,
        ),
      ),
    )
    .orderBy(asc(activityTypes.order))
    .limit(1);
  signal.throwIfAborted();
  return type ?? null;
}

export async function logCall(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  const parsed = callInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.CALL_INPUT_INVALID, "invalid call input", {
        issues: parsed.error.issues,
      }),
    );
  }
  const input = parsed.data;
  const type = await resolveCallType(db, signal);
  if (type === null) {
    return err(
      new AppError(ERROR_IDS.CALL_TYPE_MISSING, "no call activity type exists", {
        hint: "create an activity type whose name contains Call",
      }),
    );
  }

  const durationSeconds = input.durationSeconds ?? null;
  const created = await createActivity(
    db,
    actor,
    {
      typeId: type.id,
      subject: `${CALL_DIRECTION_LABELS[input.direction]} call: ${CALL_OUTCOME_LABELS[input.outcome]}`,
      dueAt: input.at ?? new Date().toISOString(),
      allDay: false,
      endAt: null,
      durationMinutes: durationSeconds === null ? null : Math.ceil(durationSeconds / 60),
      priority: null,
      dealId: input.dealId ?? null,
      leadId: null,
      personId: input.personId ?? null,
      orgId: input.organizationId ?? null,
      guestPersonIds: [],
      participantUserIds: [],
      customFields: {},
      location: null,
      note: input.note ?? null,
      videoCallUrl: null,
      done: true,
    },
    signal,
    { outcome: input.outcome, direction: input.direction, durationSeconds },
  );
  if (!created.ok) return created;
  return ok({ id: created.value.id });
}
