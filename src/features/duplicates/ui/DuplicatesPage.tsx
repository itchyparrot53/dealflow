"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkMergeDialog } from "@/features/contacts/BulkMergeDialog";
import { readCsrfToken } from "@/utils/csrfCookie";
import { dismissDuplicateAction } from "../actions";
import type { DuplicateEntity, DuplicatePair, DuplicateReason, DuplicateRecord } from "../types";

const REASON_LABELS: Record<DuplicateReason, string> = {
  email: "Same email",
  phone: "Same phone",
  name_org: "Same name and organization",
  name: "Same name",
  domain: "Same domain",
};

function pairKey(pair: DuplicatePair): string {
  return pair.a.id < pair.b.id ? `${pair.a.id}:${pair.b.id}` : `${pair.b.id}:${pair.a.id}`;
}

function RecordCard({ record }: { record: DuplicateRecord }): React.ReactNode {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="font-medium">{record.name}</p>
      <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {record.email !== null && <dd>{record.email}</dd>}
        {record.phone !== null && <dd>{record.phone}</dd>}
        {record.orgName !== null && <dd>{record.orgName}</dd>}
        {record.domain !== null && <dd>{record.domain}</dd>}
      </dl>
    </div>
  );
}

function PairList({
  entity,
  pairs,
  onMerge,
  onDismiss,
}: {
  entity: DuplicateEntity;
  pairs: DuplicatePair[];
  onMerge: (pair: DuplicatePair) => void;
  onDismiss: (pair: DuplicatePair) => void;
}): React.ReactNode {
  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">No likely duplicates found.</p>;
  }
  return (
    <ul className="space-y-3">
      {pairs.map((pair) => (
        <li key={pairKey(pair)}>
          <div
            data-testid="duplicate-pair"
            data-entity={entity}
            className="rounded-lg border bg-card p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <RecordCard record={pair.a} />
              <RecordCard record={pair.b} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {pair.reasons.map((reason) => (
                <Badge key={reason} variant="secondary">
                  {REASON_LABELS[reason]}
                </Badge>
              ))}
              <Button
                type="button"
                size="sm"
                data-testid="duplicate-merge"
                onClick={() => onMerge(pair)}
              >
                Merge
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="duplicate-dismiss"
                onClick={() => onDismiss(pair)}
              >
                Not duplicates
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// The duplicate finder page (6.7): Tabs for people and organizations, side-by-side pair cards with
// the reasons, Merge through the existing bulk merge, and "Not duplicates" storing a dismissal.
export function DuplicatesPage({
  people,
  organizations,
  capped,
}: {
  people: DuplicatePair[];
  organizations: DuplicatePair[];
  capped: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [entity, setEntity] = useState<DuplicateEntity>("person");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [merging, setMerging] = useState<DuplicatePair | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function dismiss(pair: DuplicatePair): Promise<void> {
    const result = await dismissDuplicateAction(
      { entity, aId: pair.a.id, bId: pair.b.id },
      readCsrfToken(),
    );
    if (!result.ok) {
      setError("Could not save that dismissal. Please try again.");
      return;
    }
    setError(null);
    setDismissed((previous) => new Set(previous).add(pairKey(pair)));
    router.refresh();
  }

  const visible = (pairs: DuplicatePair[]): DuplicatePair[] =>
    pairs.filter((pair) => !dismissed.has(pairKey(pair)));

  return (
    <div data-testid="duplicates-page" className="space-y-4">
      <div>
        <h1 className="text-title">Possible duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Review likely duplicates, merge the ones that are the same record, or hide the pairs that
          are not.
        </p>
      </div>

      {capped && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the first matches only; this install has more contacts than one scan checks.
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs
        value={entity}
        onValueChange={(value) => {
          setEntity(value === "organization" ? "organization" : "person");
        }}
      >
        <TabsList>
          <TabsTrigger value="person">People</TabsTrigger>
          <TabsTrigger value="organization">Organizations</TabsTrigger>
        </TabsList>
        <TabsContent value="person">
          <PairList
            entity="person"
            pairs={visible(people)}
            onMerge={setMerging}
            onDismiss={(pair) => void dismiss(pair)}
          />
        </TabsContent>
        <TabsContent value="organization">
          <PairList
            entity="organization"
            pairs={visible(organizations)}
            onMerge={setMerging}
            onDismiss={(pair) => void dismiss(pair)}
          />
        </TabsContent>
      </Tabs>

      {merging !== null && (
        <BulkMergeDialog
          kind={entity === "person" ? "person" : "org"}
          records={[
            { id: merging.a.id, name: merging.a.name },
            { id: merging.b.id, name: merging.b.name },
          ]}
          onMerged={() => {
            setMerging(null);
            router.refresh();
          }}
          onClose={() => setMerging(null)}
        />
      )}
    </div>
  );
}
