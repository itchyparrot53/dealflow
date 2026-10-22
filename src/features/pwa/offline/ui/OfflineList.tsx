"use client";
import type React from "react";
import type { OfflineRecordType, OfflineSnapshot } from "../snapshots";

function recordName(snapshot: OfflineSnapshot): string {
  switch (snapshot.type) {
    case "deal":
      return snapshot.title;
    case "person":
      return snapshot.name;
    case "organization":
      return snapshot.name;
    case "today":
      return `Today's activities (${String(snapshot.items.length)})`;
  }
}

export function recordKey(snapshot: OfflineSnapshot): string {
  return snapshot.type === "today" ? "today" : snapshot.id;
}

export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? savedAt : date.toLocaleString();
}

// The list for one tab: a name and the time the snapshot was saved. Selecting an entry opens the
// read-only detail view.
export function OfflineList({
  type,
  records,
  onSelect,
}: {
  type: OfflineRecordType;
  records: OfflineSnapshot[];
  onSelect: (snapshot: OfflineSnapshot) => void;
}): React.ReactNode {
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing saved yet. Records you open while online appear here.
      </p>
    );
  }
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {records.map((snapshot) => (
        <li key={recordKey(snapshot)}>
          <button
            type="button"
            data-testid="offline-record"
            data-id={recordKey(snapshot)}
            onClick={() => onSelect(snapshot)}
            className="flex min-h-10 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent"
          >
            <span className="min-w-0 truncate text-sm font-medium">{recordName(snapshot)}</span>
            <time
              data-testid="offline-saved-at"
              dateTime={snapshot.savedAt}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatSavedAt(snapshot.savedAt)}
            </time>
          </button>
        </li>
      ))}
      <li className="px-4 py-2 text-xs text-muted-foreground" data-type={type}>
        Showing the most recent {records.length} saved.
      </li>
    </ul>
  );
}
