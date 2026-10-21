import { and, eq, isNull } from "drizzle-orm";
import { DUPLICATE_PAGE_SIZE } from "@/constants/productivity";
import type { Db } from "@/db/client";
import { duplicateDismissals, organizations, persons } from "@/db/schema";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import type { VisiblePersonOrOrg } from "@/features/permissions/types";
import {
  domainOf,
  normalizeEmail,
  normalizeOrgName,
  normalizePersonName,
  phoneKey,
} from "./normalize";
import type { DuplicateEntity, DuplicatePair, DuplicateReason, DuplicateRecord } from "./types";

// Duplicate detection (6.7). One capped query per entity selects non-deleted rows; visibility is
// then applied with the same canSee predicate the lists use. Grouping by a normalised key finds
// pairs, and SQL cannot express diacritic folding, legal suffixes or phone formatting, so that
// part runs here over the fetched candidates.

export const DUPLICATE_CANDIDATE_CAP = 5000;

interface PersonRow {
  id: string;
  name: string;
  primaryEmail: string | null;
  emails: { value: string }[];
  phones: { value: string }[];
  orgId: string | null;
  orgName: string | null;
  ownerId: string;
  visibilityLevel: VisiblePersonOrOrg["visibilityLevel"];
  visibilityGroupId: string | null;
  visibleToUserIds: string[];
}

interface OrgRow {
  id: string;
  name: string;
  domain: string | null;
  ownerId: string;
  visibilityLevel: VisiblePersonOrOrg["visibilityLevel"];
  visibilityGroupId: string | null;
  visibleToUserIds: string[];
}

interface PersonEntry {
  record: DuplicateRecord;
  emailKey: string | null;
  phoneKey: string | null;
  nameOrgKey: string | null;
}

interface OrgEntry {
  record: DuplicateRecord;
  nameKey: string;
  domainKey: string | null;
}

function personRecord(row: PersonRow): DuplicateRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.primaryEmail ?? row.emails[0]?.value ?? null,
    phone: row.phones[0]?.value ?? null,
    orgName: row.orgName,
    domain: null,
  };
}

function orgRecord(row: OrgRow): DuplicateRecord {
  return {
    id: row.id,
    name: row.name,
    email: null,
    phone: null,
    orgName: null,
    domain: row.domain,
  };
}

function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

const REASON_RANK: Record<DuplicateReason, number> = {
  email: 0,
  domain: 0,
  phone: 1,
  name_org: 2,
  name: 2,
};

function addPair(
  pairs: Map<string, DuplicatePair>,
  a: DuplicateRecord,
  b: DuplicateRecord,
  reason: DuplicateReason,
): void {
  const key = pairKey(a.id, b.id);
  const existing = pairs.get(key);
  if (existing === undefined) pairs.set(key, { a, b, reasons: [reason] });
  else if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
}

function addGroupPairs(
  bucket: readonly DuplicateRecord[],
  reason: DuplicateReason,
  pairs: Map<string, DuplicatePair>,
): void {
  for (let i = 0; i < bucket.length; i += 1) {
    for (let j = i + 1; j < bucket.length; j += 1) {
      const a = bucket[i];
      const b = bucket[j];
      if (a !== undefined && b !== undefined) addPair(pairs, a, b, reason);
    }
  }
}

// Groups entries by one key and records a pair (with its reason) for every two rows in a group.
function groupPairs<T extends { record: DuplicateRecord }>(
  entries: readonly T[],
  keyOf: (entry: T) => string | null,
  reason: DuplicateReason,
  pairs: Map<string, DuplicatePair>,
): void {
  const groups = new Map<string, DuplicateRecord[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key === null || key === "") continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(entry.record);
    groups.set(key, bucket);
  }
  for (const bucket of groups.values()) addGroupPairs(bucket, reason, pairs);
}

async function personPairs(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<{ pairs: Map<string, DuplicatePair>; rowCount: number }> {
  const rows: PersonRow[] = await db
    .select({
      id: persons.id,
      name: persons.name,
      primaryEmail: persons.primaryEmail,
      emails: persons.emails,
      phones: persons.phones,
      orgId: persons.orgId,
      orgName: organizations.name,
      ownerId: persons.ownerId,
      visibilityLevel: persons.visibilityLevel,
      visibilityGroupId: persons.visibilityGroupId,
      visibleToUserIds: persons.visibleToUserIds,
    })
    .from(persons)
    .leftJoin(
      organizations,
      and(eq(organizations.id, persons.orgId), isNull(organizations.deletedAt)),
    )
    .where(isNull(persons.deletedAt))
    .limit(DUPLICATE_CANDIDATE_CAP);
  signal.throwIfAborted();

  const entries: PersonEntry[] = [];
  for (const row of rows) {
    const visible = canSee(actor, {
      kind: "person",
      ownerId: row.ownerId,
      visibilityLevel: row.visibilityLevel,
      visibilityGroupId: row.visibilityGroupId,
      visibleToUserIds: row.visibleToUserIds,
    });
    if (!visible) continue;
    entries.push({
      record: personRecord(row),
      emailKey: row.primaryEmail === null ? null : normalizeEmail(row.primaryEmail),
      phoneKey: row.phones[0] === undefined ? null : phoneKey(row.phones[0].value),
      nameOrgKey: row.orgId === null ? null : `${normalizePersonName(row.name)}|${row.orgId}`,
    });
  }

  const pairs = new Map<string, DuplicatePair>();
  groupPairs(entries, (entry) => entry.emailKey, "email", pairs);
  groupPairs(entries, (entry) => entry.phoneKey, "phone", pairs);
  groupPairs(entries, (entry) => entry.nameOrgKey, "name_org", pairs);
  return { pairs, rowCount: rows.length };
}

async function orgPairs(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<{ pairs: Map<string, DuplicatePair>; rowCount: number }> {
  const rows: OrgRow[] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      domain: organizations.domain,
      ownerId: organizations.ownerId,
      visibilityLevel: organizations.visibilityLevel,
      visibilityGroupId: organizations.visibilityGroupId,
      visibleToUserIds: organizations.visibleToUserIds,
    })
    .from(organizations)
    .where(isNull(organizations.deletedAt))
    .limit(DUPLICATE_CANDIDATE_CAP);
  signal.throwIfAborted();

  const entries: OrgEntry[] = [];
  for (const row of rows) {
    const visible = canSee(actor, {
      kind: "organization",
      ownerId: row.ownerId,
      visibilityLevel: row.visibilityLevel,
      visibilityGroupId: row.visibilityGroupId,
      visibleToUserIds: row.visibleToUserIds,
    });
    if (!visible) continue;
    entries.push({
      record: orgRecord(row),
      nameKey: normalizeOrgName(row.name),
      domainKey: row.domain === null ? null : domainOf(row.domain),
    });
  }

  const pairs = new Map<string, DuplicatePair>();
  groupPairs(entries, (entry) => entry.nameKey, "name", pairs);
  groupPairs(entries, (entry) => entry.domainKey, "domain", pairs);
  return { pairs, rowCount: rows.length };
}

function rankPair(pair: DuplicatePair): number {
  return Math.min(...pair.reasons.map((reason) => REASON_RANK[reason]));
}

export interface DuplicateResult {
  pairs: DuplicatePair[];
  // True when the candidate cap was reached, so the page can warn the list may be incomplete.
  capped: boolean;
}

export async function findDuplicatePairs(
  db: Db,
  actor: PermSetUser,
  entity: DuplicateEntity,
  signal: AbortSignal,
): Promise<DuplicateResult> {
  signal.throwIfAborted();
  const found =
    entity === "person" ? await personPairs(db, actor, signal) : await orgPairs(db, actor, signal);

  const dismissals = await db
    .select({ aId: duplicateDismissals.aId, bId: duplicateDismissals.bId })
    .from(duplicateDismissals)
    .where(eq(duplicateDismissals.entity, entity));
  signal.throwIfAborted();
  const dismissed = new Set(dismissals.map((row) => `${row.aId}:${row.bId}`));

  const list = [...found.pairs.entries()]
    .filter(([key]) => !dismissed.has(key))
    .map(([, pair]) => pair)
    .sort((a, b) => {
      const byRank = rankPair(a) - rankPair(b);
      return byRank !== 0 ? byRank : a.a.name.localeCompare(b.a.name);
    });

  return {
    pairs: list.slice(0, DUPLICATE_PAGE_SIZE),
    capped: found.rowCount >= DUPLICATE_CANDIDATE_CAP || list.length > DUPLICATE_PAGE_SIZE,
  };
}
