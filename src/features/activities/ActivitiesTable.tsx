"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { BulkActionBar } from "@/components/data-table/BulkActionBar";
import { ColumnsMenu } from "@/components/data-table/ColumnsMenu";
import type { ColumnDef } from "@/components/data-table/columnModel";
import { type ColumnSort, useColumnSort } from "@/components/data-table/useColumnSort";
import { useColumns } from "@/components/data-table/useColumns";
import { usePersistColumns } from "@/components/data-table/usePersistColumns";
import { RENDER_WINDOW_STEP, useRenderWindow } from "@/components/data-table/useRenderWindow";
import { useRowSelection } from "@/components/data-table/useRowSelection";
import { useActionError } from "@/components/shell/ActionErrorProvider";
import { Select } from "@/components/ui/Select";
import { useIsMobile } from "@/features/navigation/mobile/useIsMobile";
import { useRecordPreview } from "@/features/navigation/recordPreviewStore";
import { RememberRecord } from "@/features/pwa/offline/remember";
import { toTodaySnapshot } from "@/features/pwa/offline/snapshots";
import { useRowCursor } from "@/features/shortcuts/useRowCursor";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { ActivitiesFilters } from "./ActivitiesFilters";
import { ActivitiesTableHead } from "./ActivitiesTableHead";
import { ActivityDatePicker } from "./ActivityDatePicker";
import { ActivityEditModal } from "./ActivityEditModal";
import { ActivityRow } from "./ActivityRow";
import { ActivityTableBody } from "./ActivityTableBody";
import { AddActivityModal } from "./AddActivityModal";
import { completeActivityAction } from "./actions";
import type { ActivityTableRow } from "./activityRows";
import { activityRowTarget } from "./activityRowTarget";
import { followUpLinksOf, useFollowUpAfterDone } from "./followUpAfterDone";
import type { ActivitySortField } from "./schemas";
import { toEditableActivity } from "./toEditableActivity";
import { useActivityBulkActions } from "./useActivityBulkActions";
import { useActivityListFilter } from "./useActivityListFilter";

// Stable module reference: passed as useColumnSort's fallback, so `effective` only changes
// reference when the sort state itself changes (see PeopleList for the same concern).
const DEFAULT_SORT: ColumnSort<ActivitySortField> = { field: "dueAtIso", dir: "asc" };

// Column picker catalog (1.4), same model as the deals list. Subject is pinned as the row-link
// anchor; select and Done stay fixed outside the catalog because hiding them would break bulk
// selection and completion. Everything here can be hidden or reordered.
const ACTIVITY_COLUMNS: readonly ColumnDef[] = [
  { key: "subject", header: "Subject", pinned: true, defaultVisible: true },
  { key: "deal", header: "Deal", defaultVisible: true },
  { key: "priority", header: "Priority", defaultVisible: true },
  { key: "contact", header: "Contact", defaultVisible: true },
  { key: "email", header: "Email", defaultVisible: true },
  { key: "phone", header: "Phone", defaultVisible: true },
  { key: "organization", header: "Organization", defaultVisible: true },
  { key: "due", header: "Due", defaultVisible: true },
  { key: "duration", header: "Duration", defaultVisible: true },
  { key: "assignee", header: "Assignee", defaultVisible: true },
];

export function ActivitiesTable({
  currentUserId,
  initialColumns,
}: {
  currentUserId: string;
  initialColumns?: string[];
}): React.ReactNode {
  const { filter, setFilter, ready } = useActivityListFilter(currentUserId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<ActivityTableRow | null>(null);
  const selection = useRowSelection();
  const { effective, cycle } = useColumnSort<ActivitySortField>(DEFAULT_SORT);

  const router = useRouter();
  const setPreview = useRecordPreview((s) => s.setPreview);
  const reportError = useActionError();
  const rowsQ = trpc.activities.listRows.useQuery(
    { ...filter, sort: effective },
    { enabled: ready },
  );
  const typesQ = trpc.activities.listTypes.useQuery();
  const ownersQ = trpc.identity.assignableUsers.useQuery();
  const { error, bulkMarkDone, bulkReschedule, bulkChangeOwner, bulkDelete } =
    useActivityBulkActions(selection);
  const columns = useColumns(ACTIVITY_COLUMNS, initialColumns);
  usePersistColumns("activities", columns.order);
  const promptAfterDone = useFollowUpAfterDone();
  const isMobile = useIsMobile();
  const rows = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  // The offline "Today" tab remembers the activities due today from whatever the list has loaded.
  const todaySnapshot = useMemo(() => {
    const today = new Date().toDateString();
    const items = rows
      .filter((row) => row.dueAtIso !== null && new Date(row.dueAtIso).toDateString() === today)
      .map((row) => ({
        id: row.id,
        subject: row.subject,
        dueAt: row.dueAtIso,
        done: row.done,
        dealTitle: row.dealTitle,
      }));
    return toTodaySnapshot({ items });
  }, [rows]);
  // Cap how many rows are painted; the count header, select-all, and bulk actions all operate
  // over the full `rows` set, so this bounds render cost only. listRows is pagination-free, so
  // without this the default open-activities view mounts every row at once.
  const rowWindow = useRenderWindow(rows, RENDER_WINDOW_STEP);
  // A transient batched-401 (the F5-1 class) leaves data undefined AND isError=true. Painting that
  // as the empty state makes a recoverable failure look like a genuinely empty to-do list with no
  // way back, so we branch loading/error/empty explicitly (only when we have no rows to fall back
  // on). See ACTIVITIES-01.
  const loadFailed = rowsQ.isError === true && rows.length === 0;
  const loadPending = rowsQ.isPending === true && rows.length === 0;
  const visibleIds = rows.map((r) => r.id);
  const typeIdByKey = useMemo(
    () => new Map((typesQ.data ?? []).map((t) => [t.key, t.id])),
    [typesQ.data],
  );
  const types = useMemo(
    () => (typesQ.data ?? []).map((t) => ({ key: t.key, name: t.name })),
    [typesQ.data],
  );
  const owners = useMemo(
    () =>
      (ownersQ.data ?? []).map((u) => ({
        value: u.id,
        label: u.name,
        avatarName: u.name,
        avatarUrl: u.avatarUrl,
      })),
    [ownersQ.data],
  );

  // Day-grouping (Pipedrive parity) only makes sense when the effective sort is by due date:
  // grouping a non-date sort (duration/priority/subject) would render the sorted order
  // non-monotonically across day buckets, defeating the sort the user just asked for. So a
  // non-date column sort renders a flat list instead; the default (or explicit dueAtIso) sort
  // keeps the day headers.
  const groupByDay = effective.field === "dueAtIso";

  // A row points at work on a record, so opening it opens that record's drawer: the deal, or the
  // contact the activity hangs off when there is no deal. Seeding the preview first lets the
  // drawer paint a titled skeleton while the server component streams in.
  const openRow = useCallback(
    (row: ActivityTableRow) => {
      const target = activityRowTarget(row);
      if (target.kind === "edit") {
        setSelected(row);
        return;
      }
      setPreview(target.preview);
      router.push(target.href);
    },
    [router, setPreview],
  );

  // j/k walks the painted rows, Enter opens the one under the cursor (Pipedrive list parity).
  // Indexed over rowWindow.visible because day grouping preserves that order.
  const cursor = useRowCursor(rowWindow.visible.length, (i) => {
    const target = rowWindow.visible[i];
    if (target !== undefined) openRow(target);
  });
  const cursorId = cursor === null ? null : (rowWindow.visible[cursor]?.id ?? null);

  function renderRow(r: ActivityTableRow): React.ReactNode {
    return (
      <ActivityRow
        key={r.id}
        row={r}
        selected={selection.isSelected(r.id)}
        onToggleSelect={selection.toggle}
        onToggleDone={(id, currentDone) => void complete(id, currentDone)}
        onRowClick={openRow}
        cursor={r.id === cursorId}
        visibleColumns={columns.visibleColumns}
      />
    );
  }

  async function complete(id: string, currentDone: boolean): Promise<void> {
    const r = await completeActivityAction({ id, done: !currentDone }, readCsrfToken());
    if (!r.ok) {
      reportError(r.error.id);
      return;
    }
    await rowsQ.refetch();
    const row = rows.find((x) => x.id === id);
    if (!currentDone && row !== undefined) promptAfterDone(followUpLinksOf(row));
  }

  return (
    <div className="flex h-full flex-col p-4">
      <RememberRecord userId={currentUserId} snapshot={todaySnapshot} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* View toggle: List (active) vs Calendar. */}
        <div className="inline-flex rounded-md border bg-card p-0.5 text-sm">
          <span className="rounded-sm bg-accent px-2 py-1 font-medium text-accent-foreground">
            List
          </span>
          <Link
            href="/activities/calendar"
            className="rounded-sm px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            Calendar
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-action-foreground transition-transform hover:opacity-90 active:scale-[0.96]"
        >
          + Activity
        </button>
        <div data-testid="activities-columns">
          <ColumnsMenu
            catalog={[...ACTIVITY_COLUMNS]}
            order={columns.order}
            visibleKeys={columns.visibleKeys}
            onToggle={columns.toggle}
            onReorder={columns.reorder}
          />
        </div>
        {!loadFailed && !loadPending && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {rows.length} {rows.length === 1 ? "activity" : "activities"}
          </span>
        )}
      </div>

      <div className="mb-3">
        <ActivitiesFilters filter={filter} onChange={setFilter} owners={owners} types={types} />
      </div>

      {selection.count > 0 && (
        <div data-testid="activities-bulk-bar">
          <BulkActionBar count={selection.count} onClear={selection.clear}>
            <button
              type="button"
              data-testid="bulk-mark-done"
              onClick={() => void bulkMarkDone()}
              className="rounded-md border px-3 py-1 text-sm transition-transform hover:bg-accent active:scale-[0.96]"
            >
              Mark done
            </button>
            <span data-testid="bulk-reschedule" className="inline-flex">
              <ActivityDatePicker
                ariaLabel="Reschedule selected activities"
                value={null}
                placeholder="Reschedule"
                onChange={(date) => {
                  if (date !== null) void bulkReschedule(date);
                }}
              />
            </span>
            <span data-testid="bulk-owner" className="inline-flex w-40">
              <Select
                ariaLabel="Change owner of selected activities"
                value=""
                onChange={(value) => {
                  if (value !== "") void bulkChangeOwner(value);
                }}
                placeholder="Change owner"
                options={owners}
              />
            </span>
            <button
              type="button"
              data-testid="bulk-delete"
              onClick={() => void bulkDelete()}
              className="rounded-md border px-3 py-1 text-sm transition-transform hover:bg-accent active:scale-[0.96]"
            >
              Delete
            </button>
          </BulkActionBar>
        </div>
      )}

      {/* Below md every row is a card: a table with a dozen columns would scroll sideways. */}
      {isMobile && (
        <ul data-testid="activities-cards" className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openRow(row)}
                  className="min-h-10 text-left text-sm font-medium"
                >
                  {row.subject}
                </button>
                <button
                  type="button"
                  aria-label={row.done ? "Mark not done" : "Mark done"}
                  onClick={() => void complete(row.id, row.done)}
                  className="min-h-10 min-w-10 shrink-0 rounded-md border text-sm"
                >
                  {row.done ? "Undo" : "Done"}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.dueAtIso === null ? "No date" : new Date(row.dueAtIso).toLocaleString()}
                {row.dealTitle === null ? "" : ` · ${row.dealTitle}`}
                {row.assigneeName === "" ? "" : ` · ${row.assigneeName}`}
              </p>
            </li>
          ))}
          {rows.length === 0 && !loadPending && !loadFailed && (
            <li className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No activities for these filters.
            </li>
          )}
        </ul>
      )}

      <div className="hidden min-h-0 flex-1 overflow-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <ActivitiesTableHead
            effective={effective}
            onSort={cycle}
            allSelected={selection.allSelected(visibleIds)}
            onToggleAll={() => selection.toggleAll(visibleIds)}
            visibleColumns={columns.visibleColumns}
          />
          <tbody>
            <ActivityTableBody
              loadFailed={loadFailed}
              loadPending={loadPending}
              rowWindow={rowWindow}
              groupByDay={groupByDay}
              renderRow={renderRow}
              columnCount={2 + columns.visibleColumns.length}
              onRetry={() => void rowsQ.refetch()}
            />
          </tbody>
        </table>
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 self-center text-sm text-red-600">
          {error}
        </p>
      )}

      {modalOpen && <AddActivityModal onClose={() => setModalOpen(false)} />}

      {selected !== null && (
        <ActivityEditModal
          activity={toEditableActivity(selected, typeIdByKey)}
          onClose={() => setSelected(null)}
          onMarkedDone={(activityId) => {
            if (activityId !== selected.id) return;
            if (promptAfterDone(followUpLinksOf(selected))) setSelected(null);
          }}
        />
      )}
    </div>
  );
}
