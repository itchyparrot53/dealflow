import { and, eq, inArray, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { marketingSuppressions, personMarketing, persons, savedFilters } from "@/db/schema";
import {
  compileContactFilter,
  PERSON_COLUMN_SQL,
  PERSON_FILTER_CONFIG,
  personFilterSchema,
} from "@/features/contacts/contactFilter";
import { toVisibleRecord } from "@/features/contacts/personsRepo";
import { hashEmail } from "@/features/marketing/suppression";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import { parseSavedFilterDefinitionFor } from "@/features/saved-filters/parseDefinition";
import { err, ok, type Result } from "@/types/result";
import type { CampaignSegment } from "./schemas";

// 6.6's recipient preview: the same people filter the list uses, then the consent rules. The send
// snapshot (Task 3.3) reuses this so the count a user approves is the count that is mailed.

export interface SegmentExclusions {
  notSubscribed: number;
  pending: number;
  unsubscribed: number;
  bounced: number;
  suppressed: number;
  noEmail: number;
  duplicateEmail: number;
}

export interface SegmentPerson {
  id: string;
  name: string;
  email: string;
}

export interface SegmentPreview {
  matched: number;
  eligible: SegmentPerson[];
  exclusions: SegmentExclusions;
}

const EMPTY_EXCLUSIONS: SegmentExclusions = {
  notSubscribed: 0,
  pending: 0,
  unsubscribed: 0,
  bounced: 0,
  suppressed: 0,
  noEmail: 0,
  duplicateEmail: 0,
};

export async function resolveSegmentDefinition(
  db: Db,
  actor: PermSetUser,
  segment: CampaignSegment,
  signal: AbortSignal,
): Promise<Result<ReturnType<typeof personFilterSchema.parse>, AppError>> {
  if (segment.kind === "definition") {
    const parsed = personFilterSchema.safeParse(segment.definition);
    if (!parsed.success) {
      return err(
        new AppError(
          ERROR_IDS.CAMPAIGN_SEGMENT_INVALID,
          "segment is not a valid person filter",
          {},
        ),
      );
    }
    return ok(parsed.data);
  }

  const [row] = await db
    .select()
    .from(savedFilters)
    .where(and(eq(savedFilters.id, segment.savedFilterId), eq(savedFilters.targetEntity, "person")))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_SEGMENT_INVALID, "saved filter not found", {}));
  }
  if (row.ownerId !== actor.id && !row.isShared && actor.type !== "admin") {
    return err(new AppError(ERROR_IDS.CAMPAIGN_SEGMENT_INVALID, "saved filter is not visible", {}));
  }
  const definition = parseSavedFilterDefinitionFor("person", row.definition);
  const parsed = personFilterSchema.safeParse(definition);
  if (!parsed.success) {
    return err(
      new AppError(
        ERROR_IDS.CAMPAIGN_SEGMENT_INVALID,
        "saved filter is not a valid person filter",
        {},
      ),
    );
  }
  return ok(parsed.data);
}

export async function previewSegment(
  db: Db,
  actor: PermSetUser,
  segment: CampaignSegment,
  signal: AbortSignal,
): Promise<Result<SegmentPreview, AppError>> {
  signal.throwIfAborted();
  const definition = await resolveSegmentDefinition(db, actor, segment, signal);
  if (!definition.ok) return definition;

  const filterSql = compileContactFilter(definition.value, PERSON_FILTER_CONFIG, PERSON_COLUMN_SQL);
  const rows = await db
    .select()
    .from(persons)
    .where(
      filterSql === null ? isNull(persons.deletedAt) : and(isNull(persons.deletedAt), filterSql),
    )
    .limit(20_000);
  signal.throwIfAborted();

  // The people list filters visibility in process with canSee; the segment must agree with it or a
  // campaign could reach a contact the sender cannot open.
  const visible = rows.filter((row) => canSee(actor, toVisibleRecord(row)));
  const ids = visible.map((row) => row.id);
  const statusRows =
    ids.length === 0
      ? []
      : await db
          .select({ personId: personMarketing.personId, status: personMarketing.status })
          .from(personMarketing)
          .where(inArray(personMarketing.personId, ids));
  signal.throwIfAborted();
  const statusByPerson = new Map(statusRows.map((row) => [row.personId, row.status]));

  const hashes = visible
    .map((row) => row.primaryEmail)
    .filter((email): email is string => email !== null && email.trim() !== "")
    .map((email) => hashEmail(email));
  const suppressedRows =
    hashes.length === 0
      ? []
      : await db
          .select({ emailHash: marketingSuppressions.emailHash })
          .from(marketingSuppressions)
          .where(inArray(marketingSuppressions.emailHash, hashes));
  signal.throwIfAborted();
  const suppressed = new Set(suppressedRows.map((row) => row.emailHash));

  const { eligible, exclusions } = classifyPeople(visible, statusByPerson, suppressed);
  return ok({ matched: visible.length, eligible, exclusions });
}

interface ClassifiablePerson {
  id: string;
  name: string;
  primaryEmail: string | null;
}

// The consent classification, extracted so previewSegment keeps a small branch count. Later
// exclusions win over earlier ones because the counters are mutually exclusive by construction.
function classifyPeople(
  people: ClassifiablePerson[],
  statusByPerson: Map<string, string>,
  suppressed: Set<string>,
): { eligible: SegmentPerson[]; exclusions: SegmentExclusions } {
  const exclusions: SegmentExclusions = { ...EMPTY_EXCLUSIONS };
  const eligible: SegmentPerson[] = [];
  const seen = new Set<string>();

  for (const person of people) {
    const email = person.primaryEmail?.trim() ?? "";
    if (email === "") {
      exclusions.noEmail += 1;
      continue;
    }
    const status = statusByPerson.get(person.id) ?? "not_subscribed";
    if (status === "pending") {
      exclusions.pending += 1;
      continue;
    }
    if (status === "unsubscribed") {
      exclusions.unsubscribed += 1;
      continue;
    }
    if (status === "bounced") {
      exclusions.bounced += 1;
      continue;
    }
    if (status === "not_subscribed") {
      exclusions.notSubscribed += 1;
      continue;
    }
    const hash = hashEmail(email);
    if (suppressed.has(hash)) {
      exclusions.suppressed += 1;
      continue;
    }
    if (seen.has(hash)) {
      exclusions.duplicateEmail += 1;
      continue;
    }
    seen.add(hash);
    eligible.push({ id: person.id, name: person.name, email });
  }

  return { eligible, exclusions };
}
