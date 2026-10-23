// Lead source origins are stored as short identifier strings. The list shows the label a person
// would write, and an unknown value (a custom import, a future channel) still reads as a title
// instead of leaking the raw snake_case into the table.

export const SOURCE_ORIGIN_LABELS: Readonly<Record<string, string>> = {
  web_form: "Web form",
  manually_created: "Manually created",
  import: "Import",
  outbound: "Outbound",
  referral: "Referral",
  api: "API",
};

// Split snake_case, kebab-case and camelCase into words so both "web_form" and "webForm" map to
// the same label, then compare on the lower-case words. The known map keeps the exact casing each
// label wants (API stays upper case).
function words(value: string): string[] {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter((word) => word !== "");
}

export function sourceOriginLabel(value: string): string {
  const parts = words(value);
  if (parts.length === 0) return "";
  const known = SOURCE_ORIGIN_LABELS[parts.join("_").toLowerCase()];
  if (known !== undefined) return known;
  return parts
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
