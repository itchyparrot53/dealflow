import type { AppError } from "@/constants/errorIds";
import type { SpecialUse } from "@/constants/mail";
import type { Result } from "@/types/result";

// Credentials as the transport needs them. They exist decrypted only inside a call: never log
// them, never put them in an AppError context, never return them to the client.
export interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface FolderInfo {
  path: string;
  specialUse: SpecialUse | null;
}

export interface FolderStatus {
  uidValidity: bigint;
  uidNext: number;
  highestModseq: bigint | null;
  messages: number;
}

// null source means the message is larger than maxBytes and only its metadata was fetched.
export interface FetchedSource {
  uid: number;
  size: number;
  internalDate: Date | null;
  source: Buffer | null;
}

export interface ImapSession {
  readonly supportsIdle: boolean;
  listFolders(signal: AbortSignal): Promise<Result<FolderInfo[], AppError>>;
  status(folder: string, signal: AbortSignal): Promise<Result<FolderStatus, AppError>>;
  listUids(folder: string, signal: AbortSignal): Promise<Result<number[], AppError>>; // FETCH 1:* (UID)
  uidsInRange(
    folder: string,
    since: Date,
    before: Date | null,
    signal: AbortSignal,
  ): Promise<Result<number[], AppError>>; // SEARCH SINCE/BEFORE (backfill only)
  fetchSources(
    folder: string,
    uids: number[],
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<Result<FetchedSource[], AppError>>;
  fetchHeaderOnly(
    folder: string,
    uid: number,
    signal: AbortSignal,
  ): Promise<Result<Buffer | null, AppError>>;
  append(
    folder: string,
    raw: Buffer,
    flags: string[],
    signal: AbortSignal,
  ): Promise<Result<{ uid: number | null; uidValidity: bigint | null }, AppError>>;
  move(
    folder: string,
    uids: number[],
    destination: string,
    signal: AbortSignal,
  ): Promise<Result<Map<number, number>, AppError>>;
  findByMessageId(
    folder: string,
    messageId: string,
    signal: AbortSignal,
  ): Promise<Result<number[], AppError>>;
  idle(folder: string, onExists: () => void, signal: AbortSignal): Promise<Result<void, AppError>>;
  close(): Promise<void>;
}

export interface SmtpSender {
  verify(signal: AbortSignal): Promise<Result<void, AppError>>;
  send(
    raw: Buffer,
    envelope: { from: string; to: string[] },
    signal: AbortSignal,
  ): Promise<Result<{ response: string }, AppError>>;
}

export interface MailTransportFactory {
  openImap(creds: ImapCredentials, signal: AbortSignal): Promise<Result<ImapSession, AppError>>;
  smtp(creds: SmtpCredentials): SmtpSender;
}
