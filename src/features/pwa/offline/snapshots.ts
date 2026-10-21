// Compact, read-only records for the offline page. Every snapshot deliberately drops note bodies,
// email bodies and custom fields: offline mode is a memory aid, not a copy of the record.

export type DealSnapshot = {
  type: "deal";
  id: string;
  title: string;
  value: string | null;
  currency: string;
  stage: string;
  status: string;
  personName: string | null;
  orgName: string | null;
  ownerName: string | null;
  nextActivity: { subject: string; dueAt: string | null } | null;
  recentActivities: { subject: string; dueAt: string | null; done: boolean }[];
  savedAt: string;
};

export type PersonSnapshot = {
  type: "person";
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  orgName: string | null;
  ownerName: string | null;
  savedAt: string;
};

export type OrgSnapshot = {
  type: "organization";
  id: string;
  name: string;
  address: string | null;
  peopleCount: number;
  ownerName: string | null;
  savedAt: string;
};

export type TodaySnapshot = {
  type: "today";
  items: {
    id: string;
    subject: string;
    dueAt: string | null;
    done: boolean;
    dealTitle: string | null;
  }[];
  savedAt: string;
};

export type OfflineSnapshot = DealSnapshot | PersonSnapshot | OrgSnapshot | TodaySnapshot;
export type OfflineRecordType = OfflineSnapshot["type"];

// Inputs mirror what the detail pages and the activities list already load. Fields that exist on
// the page but must not be stored (an activity note, a person's notes) are listed here on purpose
// so a caller cannot pass them through by accident and the tests can prove they are dropped.
export type DealSnapshotInput = {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  stageName: string;
  status: string;
  personName: string | null;
  orgName: string | null;
  ownerName: string | null;
  nextActivity?: { subject: string; dueAt: string | null } | null;
  recentActivities?: readonly {
    subject: string;
    dueAt: string | null;
    done: boolean;
    note?: string | null;
  }[];
};

export type PersonSnapshotInput = {
  id: string;
  name: string;
  emails: readonly string[];
  phones: readonly string[];
  orgName: string | null;
  ownerName: string | null;
  notes?: string | null;
};

export type OrgSnapshotInput = {
  id: string;
  name: string;
  address: string | null;
  peopleCount: number;
  ownerName: string | null;
};

export type TodaySnapshotInput = {
  items: readonly {
    id: string;
    subject: string;
    dueAt: string | null;
    done: boolean;
    dealTitle: string | null;
  }[];
};

// The deal card shows the five most recent activities; more would not fit and would bloat storage.
const RECENT_ACTIVITY_LIMIT = 5;

export function toDealSnapshot(input: DealSnapshotInput, now: Date = new Date()): DealSnapshot {
  const recentActivities = (input.recentActivities ?? []).slice(0, RECENT_ACTIVITY_LIMIT);
  return {
    type: "deal",
    id: input.id,
    title: input.title,
    value: input.value,
    currency: input.currency,
    stage: input.stageName,
    status: input.status,
    personName: input.personName,
    orgName: input.orgName,
    ownerName: input.ownerName,
    nextActivity:
      input.nextActivity === null || input.nextActivity === undefined
        ? null
        : { subject: input.nextActivity.subject, dueAt: input.nextActivity.dueAt },
    recentActivities: recentActivities.map((activity) => ({
      subject: activity.subject,
      dueAt: activity.dueAt,
      done: activity.done,
    })),
    savedAt: now.toISOString(),
  };
}

export function toPersonSnapshot(
  input: PersonSnapshotInput,
  now: Date = new Date(),
): PersonSnapshot {
  return {
    type: "person",
    id: input.id,
    name: input.name,
    emails: [...input.emails],
    phones: [...input.phones],
    orgName: input.orgName,
    ownerName: input.ownerName,
    savedAt: now.toISOString(),
  };
}

export function toOrgSnapshot(input: OrgSnapshotInput, now: Date = new Date()): OrgSnapshot {
  return {
    type: "organization",
    id: input.id,
    name: input.name,
    address: input.address,
    peopleCount: input.peopleCount,
    ownerName: input.ownerName,
    savedAt: now.toISOString(),
  };
}

export function toTodaySnapshot(input: TodaySnapshotInput, now: Date = new Date()): TodaySnapshot {
  return {
    type: "today",
    items: input.items.map((item) => ({
      id: item.id,
      subject: item.subject,
      dueAt: item.dueAt,
      done: item.done,
      dealTitle: item.dealTitle,
    })),
    savedAt: now.toISOString(),
  };
}
