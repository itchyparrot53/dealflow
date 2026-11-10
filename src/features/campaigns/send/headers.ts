import { stripHeaderBreaks } from "@/features/email-design/variables";

// 6.7's campaign headers. The Message-ID is derived from the campaign and recipient ids, so a retry
// reuses it and mailbox providers deduplicate instead of showing the mail twice.

export interface CampaignHeadersInput {
  campaignId: string;
  recipientId: string;
  campaignType: string;
  baseUrl: string;
  // The RFC 8058 one-click endpoint: the mail client POSTs the List-Unsubscribe body here, so a
  // URL that only renders the preference page would not satisfy the one-click contract.
  unsubscribeOneClickUrl: string;
}

export function campaignSubject(subject: string): string {
  return stripHeaderBreaks(subject, 200);
}

export function campaignHeaders(input: CampaignHeadersInput): Record<string, string> {
  const domain = new URL(input.baseUrl).hostname;
  return {
    "List-Unsubscribe": `<${input.unsubscribeOneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    Precedence: "bulk",
    "X-Dealflow-Campaign": input.campaignId,
    "Message-ID": `<${input.campaignId}.${input.recipientId}@${domain}>`,
    "Feedback-ID": `${input.campaignId}:${input.campaignType}:dealflow`,
  };
}
