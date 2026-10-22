"use client";
import type React from "react";
import { Button } from "@/components/ui/Button";
import type { OfflineSnapshot } from "../snapshots";
import { formatSavedAt } from "./OfflineList";

function Row({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  if (value === null || value === undefined || value === "") return <></>;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-meta font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{value}</dd>
    </div>
  );
}

function dealDetail(snapshot: Extract<OfflineSnapshot, { type: "deal" }>): React.ReactNode {
  return (
    <dl className="space-y-3">
      <Row label="Deal" value={snapshot.title} />
      <Row
        label="Value"
        value={snapshot.value === null ? null : `${snapshot.currency} ${snapshot.value}`}
      />
      <Row label="Stage" value={snapshot.stage} />
      <Row label="Status" value={snapshot.status} />
      <Row label="Person" value={snapshot.personName} />
      <Row label="Organization" value={snapshot.orgName} />
      <Row label="Owner" value={snapshot.ownerName} />
      <Row
        label="Next activity"
        value={
          snapshot.nextActivity === null ? null : (
            <span>
              {snapshot.nextActivity.subject}
              {snapshot.nextActivity.dueAt === null ? null : (
                <span className="text-muted-foreground">
                  {" "}
                  ({new Date(snapshot.nextActivity.dueAt).toLocaleString()})
                </span>
              )}
            </span>
          )
        }
      />
      <Row
        label="Recent activities"
        value={
          snapshot.recentActivities.length === 0 ? null : (
            <ul className="space-y-1">
              {snapshot.recentActivities.map((activity, index) => (
                <li key={`${activity.subject}-${String(index)}`} className="flex gap-2">
                  <span
                    className={activity.done ? "text-muted-foreground line-through" : "font-medium"}
                  >
                    {activity.subject}
                  </span>
                  {activity.dueAt === null ? null : (
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.dueAt).toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      />
    </dl>
  );
}

function personDetail(snapshot: Extract<OfflineSnapshot, { type: "person" }>): React.ReactNode {
  return (
    <dl className="space-y-3">
      <Row label="Name" value={snapshot.name} />
      <Row label="Email" value={snapshot.emails.join(", ")} />
      <Row label="Phone" value={snapshot.phones.join(", ")} />
      <Row label="Organization" value={snapshot.orgName} />
      <Row label="Owner" value={snapshot.ownerName} />
    </dl>
  );
}

function orgDetail(snapshot: Extract<OfflineSnapshot, { type: "organization" }>): React.ReactNode {
  return (
    <dl className="space-y-3">
      <Row label="Organization" value={snapshot.name} />
      <Row label="Address" value={snapshot.address} />
      <Row label="People" value={String(snapshot.peopleCount)} />
      <Row label="Owner" value={snapshot.ownerName} />
    </dl>
  );
}

function todayDetail(snapshot: Extract<OfflineSnapshot, { type: "today" }>): React.ReactNode {
  if (snapshot.items.length === 0) {
    return <p className="text-sm text-muted-foreground">No activities were saved for today.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {snapshot.items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2">
          <span className={item.done ? "text-sm text-muted-foreground line-through" : "text-sm"}>
            {item.subject}
          </span>
          <span className="text-xs text-muted-foreground">
            {item.dealTitle === null ? "" : `${item.dealTitle} · `}
            {item.dueAt === null ? "No date" : new Date(item.dueAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The read-only detail view. Offline mode has no edit affordances on purpose.
export function OfflineRecord({
  snapshot,
  onBack,
}: {
  snapshot: OfflineSnapshot;
  onBack: () => void;
}): React.ReactNode {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {snapshot.type === "deal"
            ? snapshot.title
            : snapshot.type === "today"
              ? "Today"
              : snapshot.name}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
      {snapshot.type === "deal" && dealDetail(snapshot)}
      {snapshot.type === "person" && personDetail(snapshot)}
      {snapshot.type === "organization" && orgDetail(snapshot)}
      {snapshot.type === "today" && todayDetail(snapshot)}
      <p className="text-xs text-muted-foreground">
        Saved{" "}
        <time data-testid="offline-saved-at" dateTime={snapshot.savedAt}>
          {formatSavedAt(snapshot.savedAt)}
        </time>
      </p>
    </section>
  );
}
