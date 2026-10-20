import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { deals, persons, users } from "@/db/schema";
import { setPassword } from "@/features/auth/credentials";
import { CSRF_COOKIE } from "@/features/auth/csrf";
import { createSession, SESSION_COOKIE } from "@/features/auth/session";

// Writes Playwright storage states for the seeded demo users so specs start signed in. The
// sessions go through the real createSession path (token hashed in the database) rather than a
// hand-built cookie, so the e2e stack exercises the same authentication code the app uses.

const ADMIN_EMAIL = "demo1@example.com";
const REP_EMAIL = "demo2@example.com";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const signal = AbortSignal.timeout(30_000);

  const storageState = async (email: string): Promise<string> => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (user === undefined) throw new Error(`seed-session: no user ${email}`);
    const created = await createSession(db, user.id, signal);
    if (!created.ok) throw new Error(`seed-session: ${created.error}`);
    const expires = Math.floor(created.value.expiresAt.getTime() / 1000);
    const cookie = (name: string, value: string, httpOnly: boolean) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      expires,
      httpOnly,
      secure: true,
      sameSite: "Lax",
    });
    return JSON.stringify({
      cookies: [
        cookie(SESSION_COOKIE, created.value.sid, true),
        cookie(CSRF_COOKIE, randomBytes(32).toString("base64url"), false),
      ],
      origins: [],
    });
  };

  writeFileSync(".e2e/admin.json", await storageState(ADMIN_EMAIL));

  // The password sign-in spec needs a known credential (not just the seeded cookie sessions).
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);
  if (adminUser === undefined) throw new Error(`seed-session: no user ${ADMIN_EMAIL}`);
  await setPassword(db, adminUser.id, "correct horse battery staple", signal);

  writeFileSync(".e2e/rep.json", await storageState(REP_EMAIL));

  // A deal owned by demo1 whose contact has exactly ONE open deal: resolveLink only auto-links a
  // deal when the match is unambiguous, so the inbound thread must land on this one. Falls back to
  // any open deal when the demo data has none.
  const preferred = (
    await db.execute(sql`
      SELECT d.id, d.title, d.person_id
      FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      WHERE d.status = 'open' AND d.archived_at IS NULL AND d.deleted_at IS NULL
        AND p.is_archived = false
        AND d.owner_id = ${adminUser.id}
        AND d.person_id IS NOT NULL
        AND (SELECT count(*) FROM deals d2
             WHERE d2.person_id = d.person_id AND d2.status = 'open' AND d2.deleted_at IS NULL) = 1
      ORDER BY d.created_at ASC
      LIMIT 1
    `)
  ).rows as { id: string; title: string; person_id: string | null }[];

  let deal: { id: string; title: string; personId: string | null } | undefined =
    preferred[0] === undefined
      ? undefined
      : { id: preferred[0].id, title: preferred[0].title, personId: preferred[0].person_id };
  if (deal === undefined) {
    const fallback = await db
      .select({ id: deals.id, title: deals.title, personId: deals.personId })
      .from(deals)
      .where(and(eq(deals.status, "open"), isNull(deals.archivedAt), isNull(deals.deletedAt)))
      .orderBy(asc(deals.createdAt))
      .limit(1);
    deal = fallback[0];
  }
  if (deal === undefined) throw new Error("seed-session: no open deal found");

  let personName = "Demo contact";
  let personEmail = "contact@example.test";
  let personDealId: string | null = null;
  let personId: string | null = null;
  if (deal.personId !== null) {
    const [person] = await db
      .select({ name: persons.name, email: persons.primaryEmail })
      .from(persons)
      .where(eq(persons.id, deal.personId))
      .limit(1);
    if (person?.email !== null && person?.email !== undefined && person.email !== "") {
      personName = person.name;
      personEmail = person.email;
      personDealId = deal.id;
      personId = deal.personId;
    }
  }
  const [salesDeal] = await db
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .where(and(eq(deals.title, "Demo sales playground"), isNull(deals.deletedAt)))
    .limit(1);
  writeFileSync(
    ".e2e/fixtures.json",
    JSON.stringify({
      dealId: deal.id,
      dealTitle: deal.title,
      adminEmail: ADMIN_EMAIL,
      repEmail: REP_EMAIL,
      personName,
      personEmail,
      personDealId,
      personId,
      salesDealId: salesDeal?.id ?? null,
      salesDealTitle: salesDeal?.title ?? null,
    }),
  );
  await pool.end();
  console.warn(`seed-session: sessions written for ${ADMIN_EMAIL} and ${REP_EMAIL}`);
}

main().catch((error: unknown) => {
  console.error("seed-session failed:", error);
  process.exit(1);
});
