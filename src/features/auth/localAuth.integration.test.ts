import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { authTokens, settings, userCredentials, users } from "@/db/schema";
import { captureMailer } from "@/features/mailer/captureMailer";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import { makeTestDb, type TestDb } from "@/test/db";
import { consumeAuthToken, mintAuthToken } from "./authTokens";
import { ensureBootstrapAdmin } from "./bootstrapLocal";
import { getCredentials, markEmailVerified, setPassword } from "./credentials";
import { acceptInvite, issueInviteLink } from "./invites";
import { requestMagicLink } from "./magicLink";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import { passwordLogin } from "./passwordLogin";

const SEED = "admin@example.com";
const GOOD = "correct horse battery";
const SIG = (): AbortSignal => AbortSignal.timeout(10_000);

let h: TestDb;
let captureDir: string;

beforeAll(async () => {
  h = await makeTestDb();
});
afterAll(async () => {
  setSystemMailerForTest(null);
  await h.close();
});
afterEach(() => {
  rmSync(captureDir, { recursive: true, force: true });
});
beforeEach(async () => {
  await h.db.execute(
    sql`TRUNCATE auth_tokens, user_credentials, sessions, labels, stages, pipelines, visibility_group_members, visibility_groups, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
  captureDir = mkdtempSync(join(tmpdir(), "dealflow-auth-mail-"));
  setSystemMailerForTest(captureMailer(captureDir));
});

async function seedAdminUser(): Promise<string> {
  const created = await ensureBootstrapAdmin(
    h.db,
    SEED,
    SEED,
    { allowAfterBootstrap: true },
    SIG(),
  );
  if (!created.ok || created.value === null) throw new Error("bootstrap admin was not created");
  return created.value.userId;
}

async function inviteUser(email: string): Promise<string> {
  const [row] = await h.db
    .insert(users)
    .values({ email, name: "Invitee", invitedAt: new Date() })
    .returning({ id: users.id });
  if (row === undefined) throw new Error("invite fixture failed");
  return row.id;
}

describe("passwords", () => {
  test("hash then verify works, a wrong password fails, the policy enforces 12..128", async () => {
    const hash = await hashPassword(GOOD);
    expect(hash).not.toBe(GOOD);
    expect(await verifyPassword(hash, GOOD)).toBe(true);
    expect(await verifyPassword(hash, "not the right one")).toBe(false);
    expect(checkPasswordPolicy("a".repeat(11)).ok).toBe(false);
    expect(checkPasswordPolicy("a".repeat(129)).ok).toBe(false);
    expect(checkPasswordPolicy("a".repeat(12)).ok).toBe(true);
    expect(checkPasswordPolicy("a".repeat(128)).ok).toBe(true);
  });
});

describe("passwordLogin", () => {
  test("signs in with the right password and refuses unknown or inactive accounts", async () => {
    const userId = await seedAdminUser();
    await setPassword(h.db, userId, GOOD, SIG());

    const okLogin = await passwordLogin(h.db, { email: SEED, password: GOOD }, SIG());
    expect(okLogin.ok).toBe(true);
    if (okLogin.ok) expect(okLogin.value.userId).toBe(userId);

    const unknown = await passwordLogin(
      h.db,
      { email: "nobody@example.com", password: GOOD },
      SIG(),
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.id).toBe(ERROR_IDS.AUTH_INVALID_CREDENTIALS);

    await h.db.update(users).set({ isActive: false }).where(eq(users.id, userId));
    const inactive = await passwordLogin(h.db, { email: SEED, password: GOOD }, SIG());
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error.id).toBe(ERROR_IDS.AUTH_INVALID_CREDENTIALS);
  });

  test("locks after ten failures, and the lock expires into a clean counter", async () => {
    const userId = await seedAdminUser();
    await setPassword(h.db, userId, GOOD, SIG());

    for (let attempt = 1; attempt <= 10; attempt++) {
      const wrong = await passwordLogin(h.db, { email: SEED, password: "wrong password!" }, SIG());
      expect(wrong.ok).toBe(false);
    }
    const [lockedRow] = await h.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));
    expect(lockedRow?.lockedUntil).not.toBeNull();
    expect(lockedRow?.failedLoginCount).toBe(0);

    const locked = await passwordLogin(h.db, { email: SEED, password: GOOD }, SIG());
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error.id).toBe(ERROR_IDS.AUTH_LOCKED);

    await h.db
      .update(userCredentials)
      .set({ lockedUntil: new Date(Date.now() - 60_000) })
      .where(eq(userCredentials.userId, userId));
    const after = await passwordLogin(h.db, { email: SEED, password: GOOD }, SIG());
    expect(after.ok).toBe(true);
    const [row] = await h.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));
    expect(row?.failedLoginCount).toBe(0);
    expect(row?.lockedUntil).toBeNull();
  });
});

describe("auth tokens", () => {
  test("consumes once, rejects reuse, expiry and the wrong kind", async () => {
    const userId = await seedAdminUser();
    const { token } = await mintAuthToken(h.db, userId, "magic_link", SIG());

    const first = await consumeAuthToken(h.db, token, ["magic_link"], SIG());
    expect(first.ok).toBe(true);
    const second = await consumeAuthToken(h.db, token, ["magic_link"], SIG());
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.id).toBe(ERROR_IDS.AUTH_TOKEN_INVALID);

    const expired = await mintAuthToken(h.db, userId, "magic_link", SIG());
    await h.db
      .update(authTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(authTokens.userId, userId));
    const expiredResult = await consumeAuthToken(h.db, expired.token, ["magic_link"], SIG());
    expect(expiredResult.ok).toBe(false);

    const invite = await mintAuthToken(h.db, userId, "invite", SIG());
    const wrongKind = await consumeAuthToken(h.db, invite.token, ["magic_link"], SIG());
    expect(wrongKind.ok).toBe(false);
    if (!wrongKind.ok) expect(wrongKind.error.id).toBe(ERROR_IDS.AUTH_TOKEN_INVALID);
  });

  test("two concurrent consumes of one token: exactly one succeeds", async () => {
    const userId = await seedAdminUser();
    const { token } = await mintAuthToken(h.db, userId, "magic_link", SIG());

    const results = await Promise.all([
      consumeAuthToken(h.db, token, ["magic_link"], SIG()),
      consumeAuthToken(h.db, token, ["magic_link"], SIG()),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });
});

describe("requestMagicLink", () => {
  test("sends nothing for an unknown non-seed email and still answers ok", async () => {
    const before = readdirSync(captureDir).length;
    const result = await requestMagicLink(
      h.db,
      { email: "nobody@example.com", next: "/pipeline" },
      {
        mailer: captureMailer(captureDir),
        baseUrl: "https://app.example.com",
        seedAdminEmail: SEED,
      },
      SIG(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sent).toBe(false);
    expect(readdirSync(captureDir)).toHaveLength(before);
  });
});

describe("bootstrap", () => {
  test("creates the seed admin, closes bootstrap, and ignores other emails", async () => {
    const created = await ensureBootstrapAdmin(
      h.db,
      SEED,
      SEED,
      { allowAfterBootstrap: false },
      SIG(),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value).not.toBeNull();
    const [user] = await h.db.select().from(users).where(eq(users.email, SEED));
    expect(user?.isAdmin).toBe(true);
    const [s] = await h.db.select().from(settings);
    expect(s?.bootstrappedAt).not.toBeNull();

    const other = await ensureBootstrapAdmin(
      h.db,
      "other@example.com",
      SEED,
      { allowAfterBootstrap: false },
      SIG(),
    );
    expect(other.ok).toBe(true);
    if (other.ok) expect(other.value).toBeNull();
  });

  test("after bootstrap closes, only the recovery path can recreate the seed admin", async () => {
    const userId = await seedAdminUser();
    await h.db.delete(users).where(eq(users.id, userId));

    const closed = await ensureBootstrapAdmin(
      h.db,
      SEED,
      SEED,
      { allowAfterBootstrap: false },
      SIG(),
    );
    expect(closed.ok).toBe(true);
    if (closed.ok) expect(closed.value).toBeNull();

    const recovered = await ensureBootstrapAdmin(
      h.db,
      SEED,
      SEED,
      { allowAfterBootstrap: true },
      SIG(),
    );
    expect(recovered.ok).toBe(true);
    if (recovered.ok) expect(recovered.value).not.toBeNull();
    const [user] = await h.db.select().from(users).where(eq(users.email, SEED));
    expect(user?.isAdmin).toBe(true);
  });
});

describe("invites", () => {
  test("accepting sets the name and password, clears invited_at and allows sign-in", async () => {
    const userId = await inviteUser("new.person@example.com");
    const { url } = await issueInviteLink(h.db, userId, "https://app.example.com", SIG());
    const token = new URL(url).searchParams.get("token") ?? "";

    const accepted = await acceptInvite(h.db, { token, name: "New Person", password: GOOD }, SIG());
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.userId).toBe(userId);

    const [user] = await h.db.select().from(users).where(eq(users.id, userId));
    expect(user?.name).toBe("New Person");
    expect(user?.invitedAt).toBeNull();
    const login = await passwordLogin(
      h.db,
      { email: "new.person@example.com", password: GOOD },
      SIG(),
    );
    expect(login.ok).toBe(true);

    const reused = await acceptInvite(h.db, { token, name: "Again", password: GOOD }, SIG());
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error.id).toBe(ERROR_IDS.AUTH_TOKEN_INVALID);
  });

  test("issuing a second invite link makes the first one unusable", async () => {
    const userId = await inviteUser("second@example.com");
    const first = await issueInviteLink(h.db, userId, "https://app.example.com", SIG());
    const second = await issueInviteLink(h.db, userId, "https://app.example.com", SIG());
    const firstToken = new URL(first.url).searchParams.get("token") ?? "";
    const secondToken = new URL(second.url).searchParams.get("token") ?? "";

    const stale = await acceptInvite(h.db, { token: firstToken, name: "A", password: GOOD }, SIG());
    expect(stale.ok).toBe(false);
    const fresh = await acceptInvite(
      h.db,
      { token: secondToken, name: "B", password: GOOD },
      SIG(),
    );
    expect(fresh.ok).toBe(true);

    await markEmailVerified(h.db, userId, SIG());
    const credentials = await getCredentials(h.db, userId, SIG());
    expect(credentials?.emailVerifiedAt).not.toBeNull();
  });
});
