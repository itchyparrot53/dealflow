import { sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { encryptToken } from "@/features/email/crypto";
import { enqueueInitialSync } from "@/features/email/syncScheduling";
import type { HydratedActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";
import type { MailTransportFactory } from "../transport/types";
import { presetFor } from "./presets";

const PG_UNIQUE_VIOLATION = "23505";

// Drizzle wraps a pg error and hangs the original off `.cause`, so walk the chain.
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    if ("code" in current) {
      const code = current.code;
      if (typeof code === "string") return code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

const hostname = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/i, "invalid hostname");

// The connect form. `custom` needs all four server fields; a preset supplies them. The username
// defaults to the address, which is what Purelymail expects.
export const connectMailboxInput = z
  .object({
    emailAddress: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(512),
    preset: z.enum(["purelymail", "custom"]),
    imapHost: hostname.optional(),
    imapPort: z.coerce.number().int().min(1).max(65535).optional(),
    imapSecure: z.boolean().optional(),
    smtpHost: hostname.optional(),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    username: z.string().trim().max(254).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.preset !== "custom") return;
    for (const field of ["imapHost", "imapPort", "smtpHost", "smtpPort"] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({ code: "custom", path: [field], message: `${field} is required` });
      }
    }
  });

export type ConnectMailboxInput = z.input<typeof connectMailboxInput>;

export interface ConnectDeps {
  transports: MailTransportFactory;
  enqueueSync?: (accountId: string) => Promise<void>;
}

function hasInbox(folders: { path: string; specialUse: string | null }[]): boolean {
  return folders.some(
    (folder) => folder.specialUse === "inbox" || folder.path.toLowerCase() === "inbox",
  );
}

// Test the credentials, then store them and reset this account's sync state. The IMAP handshake
// runs BEFORE any write, so a bad password or an unreachable server leaves the existing
// connection untouched.
export async function connectImapMailbox(
  db: Db,
  actor: HydratedActor,
  rawInput: unknown,
  deps: ConnectDeps,
  signal: AbortSignal,
): Promise<Result<{ accountId: string }, AppError>> {
  signal.throwIfAborted();
  const parsed = connectMailboxInput.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.MAIL_INPUT_INVALID, "invalid connect input", {
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      }),
    );
  }
  const input = parsed.data;
  const preset = input.preset === "custom" ? null : presetFor("purelymail");

  const imap = {
    host: input.imapHost ?? preset?.imapHost ?? "",
    port: input.imapPort ?? preset?.imapPort ?? 993,
    secure: input.imapSecure ?? preset?.imapSecure ?? true,
    username: input.username ?? input.emailAddress,
    password: input.password,
  };
  const smtp = {
    host: input.smtpHost ?? preset?.smtpHost ?? "",
    port: input.smtpPort ?? preset?.smtpPort ?? 465,
    secure: input.smtpSecure ?? preset?.smtpSecure ?? true,
    username: input.username ?? input.emailAddress,
    password: input.password,
  };

  const opened = await deps.transports.openImap(imap, signal);
  if (!opened.ok) return opened;
  try {
    const folders = await opened.value.listFolders(signal);
    if (!folders.ok) return folders;
    if (!hasInbox(folders.value)) {
      return err(new AppError(ERROR_IDS.MAIL_INBOX_MISSING, "mailbox has no INBOX", {}));
    }
  } finally {
    await opened.value.close();
  }

  const verified = await deps.transports.smtp(smtp).verify(signal);
  if (!verified.ok) return verified;
  signal.throwIfAborted();

  const passwordEnc = encryptToken(input.password);
  let accountId: string;
  try {
    accountId = await db.transaction(async (tx) => {
      const account = await tx.execute(sql`
        INSERT INTO email_accounts (user_id, email_address, status)
        VALUES (${actor.id}, ${input.emailAddress}, 'connected')
        ON CONFLICT (user_id) DO UPDATE SET
          email_address = EXCLUDED.email_address,
          status = 'connected',
          sync_cursor = NULL,
          last_error_id = NULL,
          refresh_token_enc = NULL,
          updated_at = now()
        RETURNING id
      `);
      const row = account.rows[0] as { id: string } | undefined;
      if (row === undefined) {
        throw new AppError(ERROR_IDS.MAIL_CONNECT_FAILED, "account upsert returned no row", {});
      }
      await tx.execute(sql`
        INSERT INTO mail_account_credentials
          (account_id, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username, password_enc)
        VALUES (
          ${row.id}, ${imap.host}, ${imap.port}, ${imap.secure}, ${smtp.host}, ${smtp.port},
          ${smtp.secure}, ${imap.username}, ${passwordEnc}
        )
        ON CONFLICT (account_id) DO UPDATE SET
          imap_host = EXCLUDED.imap_host,
          imap_port = EXCLUDED.imap_port,
          imap_secure = EXCLUDED.imap_secure,
          smtp_host = EXCLUDED.smtp_host,
          smtp_port = EXCLUDED.smtp_port,
          smtp_secure = EXCLUDED.smtp_secure,
          username = EXCLUDED.username,
          password_enc = EXCLUDED.password_enc,
          updated_at = now()
      `);
      await tx.execute(sql`DELETE FROM mail_folder_cursors WHERE account_id = ${row.id}`);
      await tx.execute(sql`DELETE FROM mail_message_locations WHERE account_id = ${row.id}`);
      return row.id;
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      return err(
        new AppError(ERROR_IDS.MAIL_ADDRESS_TAKEN, "that address is connected by another user", {}),
      );
    }
    throw error;
  }

  // After commit: start the sync chain. A queue failure must not lose the saved connection, so it
  // is logged and the connect still succeeds (the worker boot pass will pick the mailbox up).
  try {
    await (deps.enqueueSync ?? enqueueInitialSync)(accountId);
  } catch (error) {
    console.error("[mail.connect] initial sync enqueue failed", { accountId, error });
  }
  return ok({ accountId });
}
