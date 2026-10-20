"use server";

import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, clientErr, toClientResult } from "@/types/actionResult";
import { getMailTransportFactory } from "../transport/factory";
import { connectImapMailbox } from "./connect";

// Connects (or reconnects) the signed-in user's own IMAP/SMTP mailbox. A user has at most one
// mailbox row, so the actor in the trusted context is the only subject this action can touch.
export async function connectImapMailboxAction(
  raw: unknown,
  csrfToken: string | null,
): Promise<ActionResult<{ accountId: string }>> {
  const csrf = await guardCsrf(csrfToken);
  if (!csrf.ok) return clientErr(new AppError(ERROR_IDS.PERM_DENIED, "csrf check failed", {}));

  const { actor } = await createContext();
  if (actor === null) {
    return clientErr(new AppError(ERROR_IDS.AUTH_SESSION_DEAD, "unauthenticated", {}));
  }

  return toClientResult(
    await connectImapMailbox(db, actor, raw, { transports: getMailTransportFactory() }, SIG()),
  );
}
