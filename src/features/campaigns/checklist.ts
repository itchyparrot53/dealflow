import { CAMPAIGN_HTML_LIMIT_BYTES, CAMPAIGN_HTML_WARN_BYTES } from "@/constants/campaigns";

// The Review checklist (6.6). Failures block sending; warnings do not. Pure, so the editor and the
// send path (Task 3.3) ask the same questions.

export type ChecklistStatus = "pass" | "fail" | "warning";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistStatus;
  detail?: string;
}

export interface CampaignChecklistInput {
  subject: string;
  senderVerified: boolean;
  postalAddress: string;
  recipientCount: number;
  imagesWithoutAlt: number;
  buttonsWithoutUrl: number;
  htmlBytes: number;
  domainCheck: "pass" | "missing" | "error" | null;
  testSent: boolean;
}

export function campaignChecklist(input: CampaignChecklistInput): ChecklistItem[] {
  return [
    {
      key: "subject",
      label: "Subject is set",
      status: input.subject.trim() === "" ? "fail" : "pass",
    },
    {
      key: "sender",
      label: "Sender is verified",
      status: input.senderVerified ? "pass" : "fail",
    },
    {
      key: "address",
      label: "Postal address is set in Settings > Campaigns",
      status: input.postalAddress.trim() === "" ? "fail" : "pass",
    },
    {
      key: "recipients",
      label: "At least one recipient",
      status: input.recipientCount > 0 ? "pass" : "fail",
    },
    {
      key: "alt",
      label: "Every image has alt text",
      status: input.imagesWithoutAlt === 0 ? "pass" : "fail",
      detail: input.imagesWithoutAlt === 0 ? undefined : `${input.imagesWithoutAlt} image(s)`,
    },
    {
      key: "links",
      label: "Every button has a URL",
      status: input.buttonsWithoutUrl === 0 ? "pass" : "fail",
    },
    {
      key: "size",
      label: "Email is under 100 KB",
      status: input.htmlBytes > CAMPAIGN_HTML_LIMIT_BYTES ? "fail" : "pass",
      detail:
        input.htmlBytes > CAMPAIGN_HTML_WARN_BYTES ? "over 90 KB: Gmail may clip it" : undefined,
    },
    {
      key: "domain",
      label: "Domain check passes",
      status: input.domainCheck === "pass" ? "pass" : "warning",
      detail: input.domainCheck === "pass" ? undefined : "SPF, DKIM or DMARC needs attention",
    },
    {
      key: "test",
      label: "A test email was sent",
      status: input.testSent ? "pass" : "warning",
    },
  ];
}

export function blockingFailures(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => item.status === "fail");
}
