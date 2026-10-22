// The shared list-table look (PLAN-PART11.md 6.6). Every list composes these class strings so a
// gridded Pipedrive table does not drift per feature: 33 px rows, a strong rule under the header,
// a light grid between cells, green record links and tabular numbers.
export const tableStyles = {
  table: "w-full border-collapse text-sm",
  thead: "border-b border-border-strong",
  th: "h-[33px] border-r border-grid px-3 text-left align-middle text-sm font-semibold text-foreground last:border-r-0",
  tbody: "text-sm",
  tr: "h-[33px] border-b border-grid transition-colors duration-100 hover:bg-muted data-[state=selected]:bg-info-soft",
  td: "h-[33px] border-r border-grid px-3 align-middle text-sm last:border-r-0",
  checkboxCell: "h-[33px] w-12 border-r border-grid px-3 text-left align-middle font-semibold",
  link: "text-link-record hover:underline",
  numeric: "text-right tabular",
} as const;
