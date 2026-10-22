// Shared Tailwind class for full-width text/select form inputs used across the create/edit modals.
// One source of truth so the field styling stays in step (was copy-pasted into four components).
export const FIELD_INPUT =
  "h-8 w-full rounded-md border border-border-strong bg-card px-2 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-100 ease-out placeholder:text-placeholder hover:border-placeholder focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground";

// A single bordered icon button (edit-pipeline pencil, board sort-direction toggle). Pairs a
// muted resting color with a foreground hover.
export const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-md border border-border-strong bg-card text-muted-foreground transition-[color,background-color,scale] duration-100 ease-out hover:bg-muted hover:text-foreground active:not-disabled:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-colors";

// Compact bordered text button for a list-row action (inbox Delete draft / Cancel / Archive).
export const ROW_ACTION_BUTTON =
  "shrink-0 rounded border px-2 py-1 text-xs transition-[background-color,scale] duration-150 ease-out hover:bg-accent active:not-disabled:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-colors";
