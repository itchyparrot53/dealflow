// Shared shapes for the duplicate finder (6.7).

export type DuplicateEntity = "person" | "organization";

export type DuplicateReason = "email" | "phone" | "name_org" | "name" | "domain";

export interface DuplicateRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orgName: string | null;
  domain: string | null;
}

export interface DuplicatePair {
  a: DuplicateRecord;
  b: DuplicateRecord;
  reasons: DuplicateReason[];
}
