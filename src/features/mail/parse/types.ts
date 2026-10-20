// Provider-neutral parsed message. Both the Gmail sync and the IMAP sync map their provider
// payloads into this shape before storing, so the inbound store has one input contract.
export interface ParsedMailMessage {
  providerMessageId: string; // the normalised RFC 822 Message-ID (synthetic when missing)
  rfc822MessageId: string; // same value, empty when the provider could not supply one
  inReplyTo: string | null; // normalised
  references: string[]; // normalised, oldest first, deduped
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string | null;
  snippet: string | null; // text body collapsed to single spaces, first 200 chars
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: Date | null;
  participants: string[]; // lowercased from + to + cc, deduped
  direction: "inbound" | "outbound"; // outbound when fromEmail equals ownAddress (case-insensitive)
  attachments: {
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }[];
}
