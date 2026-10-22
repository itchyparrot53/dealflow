import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { and, asc, eq, isNull, type SQL, sql } from "drizzle-orm";
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
  // Part 4: a deal with product lines whose contact has an email, so the documents spec
  // can create a snapshot quote and send it to a real address in the fake mailbox.
  const documentsDeals = (
    await db.execute(sql`
      SELECT d.id, d.title
      FROM deals d
      JOIN persons p ON p.id = d.person_id
      WHERE d.status = 'open' AND d.deleted_at IS NULL AND d.archived_at IS NULL
        -- The admin can edit (and so document) a deal owned by any demo user.
        AND p.primary_email IS NOT NULL AND p.primary_email::text <> ''
        AND EXISTS (SELECT 1 FROM deal_products dp WHERE dp.deal_id = d.id)
      ORDER BY d.title ASC
      LIMIT 1
    `)
  ).rows as { id: string; title: string }[];

  // Part 11 design gallery: resolve one row per detail screen, so the design spec never has to
  // click through a list. Public ids are read where the screen needs a public URL.
  const first = async (query: SQL): Promise<Record<string, unknown> | undefined> =>
    (await db.execute(query)).rows[0];
  const firstString = async (query: SQL): Promise<string | null> => {
    const row = await first(query);
    return (row?.publicId as string | undefined) ?? null;
  };
  const pipelineId = await firstString(
    sql`SELECT id AS "publicId" FROM pipelines WHERE is_archived = false ORDER BY created_at ASC LIMIT 1`,
  );
  const orgId = await firstString(
    sql`SELECT id AS "publicId" FROM organizations ORDER BY created_at ASC LIMIT 1`,
  );
  const leadId = await firstString(
    sql`SELECT id AS "publicId" FROM leads ORDER BY created_at ASC LIMIT 1`,
  );
  const projectId = await firstString(
    sql`SELECT id AS "publicId" FROM projects ORDER BY created_at ASC LIMIT 1`,
  );
  const documentId = await firstString(
    sql`SELECT id AS "publicId" FROM documents ORDER BY created_at ASC LIMIT 1`,
  );
  // The design gallery opens this URL directly, and drafts are not publicly visible, so pick the
  // first issued quote. Otherwise /d/<draft> renders Next's 404 instead of the document page.
  const documentPublicId = await firstString(
    sql`SELECT public_id AS "publicId" FROM documents WHERE public_id IS NOT NULL AND kind = 'quote' AND status IN ('sent', 'accepted') ORDER BY created_at ASC LIMIT 1`,
  );
  const dashboardId = await firstString(
    sql`SELECT id AS "publicId" FROM dashboards ORDER BY created_at ASC LIMIT 1`,
  );
  const reportId = await firstString(
    sql`SELECT id AS "publicId" FROM reports ORDER BY created_at ASC LIMIT 1`,
  );
  const threadId = await firstString(
    sql`SELECT id AS "publicId" FROM email_threads ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
  );
  const automationId = await firstString(
    sql`SELECT id AS "publicId" FROM automations ORDER BY created_at ASC LIMIT 1`,
  );
  const formPublicId = await firstString(
    sql`SELECT public_id AS "publicId" FROM web_forms WHERE public_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
  );
  const bookingPublicId = await firstString(
    sql`SELECT public_id AS "publicId" FROM booking_pages WHERE public_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
  );

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
      documentsDealId: documentsDeals[0]?.id ?? null,
      documentsDealTitle: documentsDeals[0]?.title ?? null,
      pipelineId,
      orgId,
      leadId,
      projectId,
      documentId,
      documentPublicId,
      dashboardId,
      reportId,
      threadId,
      automationId,
      formPublicId,
      bookingPublicId,
    }),
  );
  await pool.end();
  console.warn(`seed-session: sessions written for ${ADMIN_EMAIL} and ${REP_EMAIL}`);
}

main().catch((error: unknown) => {
  console.error("seed-session failed:", error);
  process.exit(1);
});
