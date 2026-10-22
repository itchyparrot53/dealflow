"use client";
import type React from "react";
import { CustomFieldCell, customFieldCellClass } from "@/components/data-table/CustomFieldCell";
import type { ColumnSort } from "@/components/data-table/useColumnSort";
import { Avatar } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { tableStyles } from "@/components/ui/table-styles";
import { RecordLink } from "@/features/navigation/RecordLink";
import type { OrgColumn } from "./orgColumns";
import type { OrgSortField } from "./schemas";

export interface OrgsListRow {
  id: string;
  name: string;
  // Owner display name for the mobile card; optional so existing fixtures stay valid.
  ownerName?: string | null;
  address: Record<string, unknown> | null;
  customFields: Record<string, unknown>;
  peopleCount: number;
  closedDeals: number;
  openDeals: number;
}

// Compact one-line address for the list row (e.g. "Austin, US"), not the full structured
// address (street/region/postal/coords) shown on the org detail page.
function formatAddress(address: Record<string, unknown> | null): string {
  if (address === null) return "";
  const parts = [address.city, address.country].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.join(", ");
}

export interface OrgsTableProps {
  rows: OrgsListRow[];
  sort: ColumnSort<OrgSortField>;
  onSort: (field: OrgSortField) => void;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  visibleColumns: readonly OrgColumn[];
  columnsMenu?: React.ReactNode;
  currency: string;
}

function SortGlyph({ dir }: { dir: "asc" | "desc" | null }): React.ReactNode {
  if (dir === null) return null;
  return (
    <span aria-hidden="true" className="ml-1 inline-block text-caption">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function SortableHeader({
  field,
  label,
  sort,
  onSort,
}: {
  field: OrgSortField;
  label: string;
  sort: ColumnSort<OrgSortField>;
  onSort: (field: OrgSortField) => void;
}): React.ReactNode {
  return (
    <th className={tableStyles.th}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center hover:text-foreground"
      >
        {label}
        <SortGlyph dir={sort.field === field ? sort.dir : null} />
      </button>
    </th>
  );
}

// Presentational organizations table: header select-all + a sortable Name header, and a
// per-row checkbox. Extracted from OrgsList (the data/fetch container) to keep both files
// under the project's file-size budget, mirroring PeopleTable/PeopleList.
function renderOrgCell(col: OrgColumn, row: OrgsListRow, currency: string): React.ReactNode {
  if (col.customField !== undefined) {
    return (
      <CustomFieldCell
        def={col.customField}
        value={row.customFields[col.customField.key]}
        currency={currency}
      />
    );
  }
  switch (col.key) {
    case "name":
      return (
        <RecordLink
          href={`/contacts/orgs/${row.id}`}
          preview={{ id: row.id, title: row.name }}
          className="flex items-center gap-2.5 font-medium text-link-record hover:underline"
        >
          <Avatar name={row.name} className="h-6 w-6 rounded-md" />
          {row.name}
        </RecordLink>
      );
    case "address":
      return formatAddress(row.address);
    case "peopleCount":
      return row.peopleCount;
    case "closedDeals":
      return row.closedDeals;
    case "openDeals":
      return row.openDeals;
    default:
      return "";
  }
}

function cellClass(col: OrgColumn): string {
  if (col.customField !== undefined) return customFieldCellClass(col.customField);
  if (col.key === "peopleCount" || col.key === "closedDeals" || col.key === "openDeals") {
    return "px-3 py-2 tabular-nums text-muted-foreground";
  }
  if (col.key === "name") return "px-3 py-2";
  return `${tableStyles.td} text-muted-foreground`;
}

export function OrgsTable({
  rows,
  sort,
  onSort,
  isSelected,
  allSelected,
  onToggleRow,
  onToggleAll,
  visibleColumns,
  columnsMenu,
  currency,
}: OrgsTableProps): React.ReactNode {
  return (
    <div className="overflow-hidden">
      {columnsMenu !== undefined ? (
        <div className="flex items-center justify-end pb-1.5">{columnsMenu}</div>
      ) : null}
      <div className="overflow-x-auto">
        <table className={tableStyles.table}>
          <thead className={tableStyles.thead}>
            <tr>
              <th className={tableStyles.checkboxCell}>
                <Checkbox
                  label="Select all organizations"
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                />
              </th>
              {visibleColumns.map((col) =>
                col.sortField !== undefined ? (
                  <SortableHeader
                    key={col.key}
                    field={col.sortField}
                    label={col.header}
                    sort={sort}
                    onSort={onSort}
                  />
                ) : (
                  <th key={col.key} className={tableStyles.th}>
                    {col.header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={tableStyles.tr}>
                <td className={tableStyles.td}>
                  <Checkbox
                    label={`Select ${row.name}`}
                    checked={isSelected(row.id)}
                    onCheckedChange={() => onToggleRow(row.id)}
                  />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className={cellClass(col)}>
                    {renderOrgCell(col, row, currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
