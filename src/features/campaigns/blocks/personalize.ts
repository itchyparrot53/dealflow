import { escapeHtml } from "@/features/email-design/variables";

// Merge tokens for campaigns (6.4): `{{person.first_name}}`, and `{{person.first_name|there}}`
// for a fallback. The Part 13 engine has no fallback form, so campaigns extend it here rather
// than changing one-to-one email rendering.

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s*(?:\|\s*([^}]*))?\}\}/g;

export type MergeMode = "html" | "text";

export function renderMerge(
  template: string,
  values: Readonly<Record<string, string>>,
  mode: MergeMode,
): string {
  return template.replace(TOKEN, (_match, name: string, fallback: string | undefined) => {
    const raw = values[name];
    const value = raw === undefined || raw === "" ? (fallback ?? "") : raw;
    return mode === "html" ? escapeHtml(value) : value;
  });
}

export function mergeTokenNames(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(TOKEN)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  return [...names];
}

export interface CampaignMergeSource {
  person: {
    firstName: string | null;
    lastName: string | null;
    name: string;
    email: string | null;
  };
  organization: { name: string } | null;
  owner: { name: string; email: string } | null;
  companyName: string;
  unsubscribeUrl: string;
  webVersionUrl: string;
}

// The variables 6.4 lists, plus the two structural URLs the footer needs.
export function campaignMergeValues(source: CampaignMergeSource): Record<string, string> {
  return {
    "person.first_name": source.person.firstName ?? "",
    "person.last_name": source.person.lastName ?? "",
    "person.name": source.person.name,
    "person.email": source.person.email ?? "",
    "organization.name": source.organization?.name ?? "",
    "owner.name": source.owner?.name ?? "",
    "owner.email": source.owner?.email ?? "",
    "company.name": source.companyName,
    unsubscribe_url: source.unsubscribeUrl,
    web_version_url: source.webVersionUrl,
  };
}
