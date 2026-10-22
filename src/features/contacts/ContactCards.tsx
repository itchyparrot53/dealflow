"use client";
import Link from "next/link";
import type React from "react";
import type { OrgsListRow } from "./OrgsTable";
import type { PeopleListRow } from "./PeopleTable";

// Mobile card rows for the contact lists (6.9): a wide table leaves about 110px beside the
// contacts rail on a phone, so below md the list becomes name / organization (or people count) /
// owner cards that link to the same detail pages.
export function PeopleCards({ rows }: { rows: PeopleListRow[] }): React.ReactNode {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No people match these filters.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/contacts/people/${row.id}`}
            data-testid="contact-card"
            className="block rounded-lg border bg-card p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{row.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.ownerName ?? ""}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.orgName ?? row.primaryEmail ?? ""}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OrgCards({ rows }: { rows: OrgsListRow[] }): React.ReactNode {
  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No organizations match these filters.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/contacts/orgs/${row.id}`}
            data-testid="contact-card"
            className="block rounded-lg border bg-card p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{row.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.ownerName ?? ""}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.peopleCount} {row.peopleCount === 1 ? "person" : "people"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
