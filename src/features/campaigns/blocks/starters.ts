import type { CampaignDocument } from "./schema";

// The four starter documents from 6.4. Neutral copy, valid against the schema, and each id is
// stable per starter so tests and screenshots are deterministic.

export const CAMPAIGN_STARTER_KEYS = ["newsletter", "announcement", "event", "simple"] as const;
export type CampaignStarterKey = (typeof CAMPAIGN_STARTER_KEYS)[number];

export interface CampaignStarter {
  key: CampaignStarterKey;
  name: string;
  description: string;
  document: CampaignDocument;
}

const SETTINGS = {
  backgroundColor: "#F4F4F2",
  contentWidth: 600,
  fontFamily: "system",
  linkColor: "#2D8548",
} as const;

const SOURCE = "https://example.com";

function doc(blocks: CampaignDocument["blocks"]): CampaignDocument {
  return { version: 1, settings: { ...SETTINGS, linkColor: SETTINGS.linkColor }, blocks };
}

export const CAMPAIGN_STARTERS: readonly CampaignStarter[] = [
  {
    key: "newsletter",
    name: "Newsletter",
    description: "A header, a lead story, two columns of links and a sign-up button.",
    document: doc([
      { id: "n-header", type: "header", logo: "company", align: "left" },
      {
        id: "n-heading",
        type: "heading",
        text: "This month at {{company.name}}",
        level: 1,
        align: "left",
      },
      {
        id: "n-text",
        type: "text",
        html: "<p>Hi {{person.first_name|there}}, here is what we have been working on and what is coming next.</p>",
      },
      {
        id: "n-columns",
        type: "columns",
        columns: [
          [
            { id: "n-left-heading", type: "heading", text: "Product", level: 2, align: "left" },
            {
              id: "n-left-text",
              type: "text",
              html: "<p>New features and fixes from this month.</p>",
            },
          ],
          [
            { id: "n-right-heading", type: "heading", text: "Reading", level: 2, align: "left" },
            { id: "n-right-text", type: "text", html: "<p>Guides and stories we liked.</p>" },
          ],
        ],
      },
      { id: "n-button", type: "button", label: "Read the update", href: SOURCE, align: "left" },
      { id: "n-social", type: "social", links: [{ network: "linkedin", url: SOURCE }] },
    ]),
  },
  {
    key: "announcement",
    name: "Announcement",
    description: "A short, direct note with one call to action.",
    document: doc([
      { id: "a-header", type: "header", logo: "company", align: "center" },
      {
        id: "a-heading",
        type: "heading",
        text: "Something new from {{company.name}}",
        level: 1,
        align: "center",
      },
      {
        id: "a-text",
        type: "text",
        html: "<p>Hi {{person.first_name|there}}, we have news we think you will want to see.</p><p>It is short, useful and ready today.</p>",
      },
      { id: "a-button", type: "button", label: "Take a look", href: SOURCE, align: "center" },
    ]),
  },
  {
    key: "event",
    name: "Event invitation",
    description: "Date, place and agenda with a Save your seat button.",
    document: doc([
      { id: "e-header", type: "header", logo: "company", align: "left" },
      {
        id: "e-heading",
        type: "heading",
        text: "You are invited: {{company.name}} live",
        level: 1,
        align: "left",
      },
      {
        id: "e-text",
        type: "text",
        html: "<p>Hi {{person.first_name|there}}, join us for an hour of practical ideas.</p><p><strong>When:</strong> Thursday, 10:00<br><strong>Where:</strong> Online<br><strong>Agenda:</strong> a short talk, a demo and questions.</p>",
      },
      { id: "e-button", type: "button", label: "Save your seat", href: SOURCE, align: "left" },
    ]),
  },
  {
    key: "simple",
    name: "Simple text",
    description: "Just a personal note, no header or images.",
    document: doc([
      {
        id: "s-text",
        type: "text",
        html: "<p>Hi {{person.first_name|there}},</p><p>A short update from us, written the way we would write an email to a friend.</p><p>Thanks for reading.</p>",
      },
    ]),
  },
] as const;

export function starterByKey(key: string): CampaignStarter | null {
  return CAMPAIGN_STARTERS.find((starter) => starter.key === key) ?? null;
}
