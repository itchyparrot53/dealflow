/**
 * Per-IP request allowances for the unauthenticated edge.
 *
 * Sized to be far above real usage and far below what makes an endpoint a useful amplifier.
 * A legitimate caller should never see one of these; if a limit starts firing on real traffic,
 * that is a signal to look at why the traffic changed, not to raise the number reflexively.
 *
 * Window is expressed in ms to match createRateLimiter.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RATE_LIMITS = {
  // Registering an OAuth client is a once-per-integration act. Anything beyond a handful an
  // hour from one address is someone filling the table, not someone onboarding a client.
  oauthRegister: { limit: 5, windowMs: HOUR },
  // Access tokens live an hour (ACCESS_TOKEN_TTL_SECONDS), so a well-behaved client touches
  // this endpoint about once an hour per grant. The ceiling leaves room for many grants and
  // for retry storms without leaving room for grinding.
  oauthToken: { limit: 60, windowMs: MINUTE },
  // Starting a Google login is a human act with a redirect in the middle.
  authStart: { limit: 20, windowMs: MINUTE },
  // Password sign-in: 10 attempts per minute per address. The account-level lockout (10 failures,
  // 15 minutes) is the real throttle; this only stops one address grinding many accounts.
  authPassword: { limit: 10, windowMs: MINUTE },
  // Requesting a sign-in link also sends mail, so the ceiling is low and the window long.
  authMagicRequest: { limit: 5, windowMs: 15 * MINUTE },
  // Opening a link or accepting an invite: a human act, but the token is a secret, so allow
  // retries without allowing a fast grind (30 per minute).
  authTokenVerify: { limit: 30, windowMs: MINUTE },
  // The container healthcheck polls every 15s (4/min). The rest of the headroom is for
  // whatever external monitoring an operator points at it.
  health: { limit: 60, windowMs: MINUTE },
  // Deliberately generous: a corporate mail gateway can NAT a whole company behind one address
  // and prefetch images for all of them. Exceeding this does not fail the request, it only
  // skips the recording (see the tracking routes), so a high ceiling costs nothing.
  emailTracking: { limit: 240, windowMs: MINUTE },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;
