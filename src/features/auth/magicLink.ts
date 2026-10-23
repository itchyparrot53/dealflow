import { eq } from "drizzle-orm";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { ok, type Result } from "@/types/result";
import { mintAuthToken } from "./authTokens";
import { ensureBootstrapAdmin } from "./bootstrapLocal";

export interface MagicLinkDeps {
  // Rendered and sent by sendSystemEmail in the route; injected for tests.
  send: (
    to: string,
    variables: Record<string, string>,
    signal: AbortSignal,
  ) => Promise<Result<{ messageId: string }, AppError>>;
  baseUrl: string;
  seedAdminEmail: string;
}

// Never reveals whether an address exists: unknown emails answer the same as known ones. The seed
// address may create the first admin here while bootstrap is still open.
export async function requestMagicLink(
  db: Db,
  input: { email: string; next: string },
  deps: MagicLinkDeps,
  signal: AbortSignal,
): Promise<Result<{ sent: boolean }, AppError>> {
  const email = input.email.trim().toLowerCase();

  const bootstrap = await ensureBootstrapAdmin(
    db,
    email,
    deps.seedAdminEmail,
    { allowAfterBootstrap: false },
    signal,
  );
  if (!bootstrap.ok) return bootstrap;

  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  signal.throwIfAborted();
  if (user === undefined || !user.isActive) return ok({ sent: false });

  const { token } = await mintAuthToken(db, user.id, "magic_link", signal);
  const url = `${deps.baseUrl}/login/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent(input.next)}`;
  const sent = await deps.send(
    email,
    {
      "recipient.name": email,
      "recipient.email": email,
      "link.url": url,
      "link.expires_in": "15 minutes",
      "app.url": deps.baseUrl,
      "company.name": "",
    },
    signal,
  );
  if (!sent.ok) return sent;
  return ok({ sent: true });
}
