// Part 14 demo campaigns. Kept out of seed-demo.ts so the campaign shapes and their deterministic
// event mix stay together. Re-runnable: it deletes its own fixed-name rows first. The 60% consent
// pass is idempotent and uses its own PRNG, so the core demo records are unchanged.

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { CAMPAIGN_STARTERS } from "@/features/campaigns/blocks/starters";
import { makeRng } from "./seed-demo-data";
import type { Db } from "./seed-smoke-phase5-infra";

const SEED = 0xca11;
const E2E_PEOPLE = [
  "Campaign E2E One",
  "Campaign E2E Two",
  "Campaign E2E Three",
  "Campaign E2E Four",
  "Campaign E2E Five",
] as const;
const E2E_EMAILS = E2E_PEOPLE.map((_, index) => `campaign.e2e${index + 1}@example.com`);
const SENDERS = [
  { name: "Demo News", email: "demo-news@example.com" },
  { name: "Demo Announcements", email: "demo-announcements@example.com" },
] as const;
const FILTER_NAME = "Campaign E2E";
const SEQUENCE_NAME = "Demo nurture";
const CAMPAIGN_NAMES = [
  "Demo newsletter",
  "Demo announcement",
  "Demo scheduled",
  "Demo draft",
] as const;
const HIDDEN_NAMES = ["Demo nurture step 1", "Demo nurture step 3"] as const;
const ALL_CAMPAIGN_NAMES = [...CAMPAIGN_NAMES, ...HIDDEN_NAMES];

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function rawToken(): string {
  return randomBytes(24).toString("base64url");
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

interface SeedArgs {
  db: Db;
  ownerId: string;
  personIds: readonly string[];
}

interface RecipientSpec {
  personId: string;
  email: string;
  status?: "sent" | "bounced_hard";
  events: readonly ("open_human" | "open_proxy" | "click" | "unsubscribe" | "bounce_hard")[];
}

async function cleanup(db: Db): Promise<void> {
  await db.q(`DELETE FROM campaigns WHERE name = ANY($1::text[])`, [ALL_CAMPAIGN_NAMES]);
  await db.q(`DELETE FROM sequences WHERE name = $1`, [SEQUENCE_NAME]);
  await db.q(`DELETE FROM campaign_senders WHERE from_email = ANY($1::citext[])`, [
    SENDERS.map((sender) => sender.email),
  ]);
  await db.q(`DELETE FROM saved_filters WHERE name = $1 AND target_entity = 'person'`, [
    FILTER_NAME,
  ]);
  await db.q(`DELETE FROM persons WHERE primary_email = ANY($1::citext[])`, [E2E_EMAILS]);
}

async function subscribeSixtyPercent(
  db: Db,
  personIds: readonly string[],
  rng: () => number,
): Promise<void> {
  if (personIds.length === 0) return;
  const rows = await db.q<{ id: string }>(
    `SELECT id FROM persons WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [personIds],
  );
  for (const row of rows) {
    if (rng() >= 0.6) continue;
    await db.q(
      `INSERT INTO person_marketing (person_id, status, consent_basis, status_changed_at)
       VALUES ($1, 'subscribed', 'explicit', now())
       ON CONFLICT (person_id) DO UPDATE
       SET status = 'subscribed', consent_basis = 'explicit', status_changed_at = now()`,
      [row.id],
    );
  }
}

async function insertSenders(db: Db, ownerId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const sender of SENDERS) {
    const [row] = await db.q<{ id: string }>(
      `INSERT INTO campaign_senders (from_name, from_email, verified_at, created_by)
       VALUES ($1, $2::citext, now(), $3)
       RETURNING id`,
      [sender.name, sender.email, ownerId],
    );
    if (row === undefined) throw new Error("demo campaign sender insert failed");
    ids[sender.email] = row.id;
  }
  return ids;
}

async function insertE2ePeople(db: Db, ownerId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, name] of E2E_PEOPLE.entries()) {
    const email = E2E_EMAILS[index] ?? `campaign.e2e${index + 1}@example.com`;
    const [row] = await db.q<{ id: string }>(
      `INSERT INTO persons (name, primary_email, emails, owner_id, visibility_level)
       VALUES ($1, $2::citext, $3::jsonb, $4, 'all')
       RETURNING id`,
      [name, email, JSON.stringify([{ label: "work", value: email, primary: true }]), ownerId],
    );
    if (row === undefined) throw new Error("demo campaign person insert failed");
    ids.push(row.id);
  }
  // One already subscribed, three left for the consent test to subscribe, one subscribed so the
  // test can unsubscribe it (the 6.2 table has no not_subscribed -> unsubscribed edge).
  for (const index of [0, 4]) {
    const personId = ids[index];
    if (personId === undefined) continue;
    await db.q(
      `INSERT INTO person_marketing (person_id, status, consent_basis, status_changed_at)
       VALUES ($1, 'subscribed', 'explicit', now())
       ON CONFLICT (person_id) DO UPDATE
       SET status = 'subscribed', consent_basis = 'explicit', status_changed_at = now()`,
      [personId],
    );
  }
  return ids;
}

async function insertSavedFilter(db: Db, ownerId: string): Promise<string> {
  const [row] = await db.q<{ id: string }>(
    `INSERT INTO saved_filters (name, target_entity, definition, owner_id, is_shared)
     VALUES ($1, 'person', $2::jsonb, $3, true)
     RETURNING id`,
    [
      FILTER_NAME,
      JSON.stringify({
        combinator: "and",
        conditions: [{ field: "name", op: "contains", value: "Campaign E2E" }],
      }),
      ownerId,
    ],
  );
  if (row === undefined) throw new Error("demo campaign saved filter insert failed");
  return row.id;
}

type SeedEvent = RecipientSpec["events"][number];

async function insertOpenEvent(
  db: Db,
  input: { campaignId: string; recipientId: string; personId: string; family: string },
): Promise<void> {
  await db.q(
    `INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type, user_agent_family)
     VALUES ($1, $2, $3, 'open', $4)`,
    [input.campaignId, input.recipientId, input.personId, input.family],
  );
}

async function insertClickEvent(
  db: Db,
  input: { campaignId: string; recipientId: string; personId: string },
): Promise<void> {
  await db.q(
    `INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type, link_index)
     VALUES ($1, $2, $3, 'click', 0)`,
    [input.campaignId, input.recipientId, input.personId],
  );
}

async function insertUnsubscribeEvent(
  db: Db,
  input: { campaignId: string; recipientId: string; personId: string; emailHash: string },
): Promise<void> {
  await db.q(
    `INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type)
     VALUES ($1, $2, $3, 'unsubscribe')`,
    [input.campaignId, input.recipientId, input.personId],
  );
  await db.q(
    `INSERT INTO person_marketing (person_id, status, consent_basis, status_changed_at)
     VALUES ($1, 'unsubscribed', NULL, now())
     ON CONFLICT (person_id) DO UPDATE SET status = 'unsubscribed', status_changed_at = now()`,
    [input.personId],
  );
  await db.q(
    `INSERT INTO marketing_suppressions (email_hash, reason)
     VALUES ($1, 'unsubscribed') ON CONFLICT DO NOTHING`,
    [input.emailHash],
  );
}

async function insertBounceEvent(
  db: Db,
  input: { campaignId: string; recipientId: string; personId: string; emailHash: string },
): Promise<void> {
  await db.q(
    `INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type)
     VALUES ($1, $2, $3, 'bounce_hard')`,
    [input.campaignId, input.recipientId, input.personId],
  );
  await db.q(`UPDATE campaign_recipients SET status = 'bounced_hard' WHERE id = $1`, [
    input.recipientId,
  ]);
  await db.q(
    `INSERT INTO person_marketing (person_id, status, consent_basis, status_changed_at)
     VALUES ($1, 'bounced', NULL, now())
     ON CONFLICT (person_id) DO UPDATE SET status = 'bounced', status_changed_at = now()`,
    [input.personId],
  );
  await db.q(
    `INSERT INTO marketing_suppressions (email_hash, reason)
     VALUES ($1, 'hard_bounce') ON CONFLICT DO NOTHING`,
    [input.emailHash],
  );
}

async function insertEventsForRecipient(
  db: Db,
  input: {
    campaignId: string;
    recipientId: string;
    personId: string;
    emailHash: string;
    events: readonly SeedEvent[];
  },
  totals: Record<string, number>,
): Promise<void> {
  for (const event of input.events) {
    switch (event) {
      case "open_human":
        await insertOpenEvent(db, { ...input, family: "chrome" });
        totals.opens = (totals.opens ?? 0) + 1;
        totals.uniqueHumanOpens = (totals.uniqueHumanOpens ?? 0) + 1;
        break;
      case "open_proxy":
        await insertOpenEvent(db, { ...input, family: "proxy" });
        totals.opens = (totals.opens ?? 0) + 1;
        totals.machineOpens = (totals.machineOpens ?? 0) + 1;
        break;
      case "click":
        await insertClickEvent(db, input);
        totals.clicks = (totals.clicks ?? 0) + 1;
        totals.uniqueClicks = (totals.uniqueClicks ?? 0) + 1;
        break;
      case "unsubscribe":
        await insertUnsubscribeEvent(db, input);
        totals.unsubscribes = (totals.unsubscribes ?? 0) + 1;
        break;
      case "bounce_hard":
        await insertBounceEvent(db, input);
        totals.bouncesHard = (totals.bouncesHard ?? 0) + 1;
        totals.delivered = (totals.delivered ?? 0) - 1;
        break;
    }
  }
}

async function insertSentCampaign(
  db: Db,
  input: {
    name: string;
    type: string;
    subject: string;
    preheader: string;
    document: unknown;
    senderId: string;
    segmentFilterId: string;
    ownerId: string;
    startedAt: Date;
    recipients: RecipientSpec[];
    linkUrl: string;
  },
): Promise<{ id: string; token: string; totals: Record<string, number> }> {
  const [campaign] = await db.q<{ id: string }>(
    `INSERT INTO campaigns
       (name, type, status, subject, preheader, sender_id, segment, content, created_by,
        send_as_user_id, started_at, finished_at, totals)
     VALUES ($1, $2, 'sent', $3, $4, $5, $6::jsonb, $7::jsonb, $8, $8, $9, $9, '{}'::jsonb)
     RETURNING id`,
    [
      input.name,
      input.type,
      input.subject,
      input.preheader,
      input.senderId,
      JSON.stringify({ kind: "saved_filter", savedFilterId: input.segmentFilterId }),
      JSON.stringify(input.document),
      input.ownerId,
      input.startedAt,
    ],
  );
  if (campaign === undefined) throw new Error("demo campaign insert failed");
  await db.q(
    `INSERT INTO campaign_links (campaign_id, link_index, url_template) VALUES ($1, 0, $2)`,
    [campaign.id, input.linkUrl],
  );

  const totals: Record<string, number> = {
    recipients: input.recipients.length,
    sent: input.recipients.length,
    delivered: input.recipients.length,
    opens: 0,
    uniqueOpens: 0,
    uniqueHumanOpens: 0,
    machineOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    unsubscribes: 0,
    bouncesHard: 0,
    bouncesSoft: 0,
    complaints: 0,
  };
  let firstToken = "";
  for (const recipient of input.recipients) {
    const token = rawToken();
    if (firstToken === "") firstToken = token;
    const [row] = await db.q<{ id: string }>(
      `INSERT INTO campaign_recipients
         (campaign_id, person_id, email, email_hash, status, token, token_hash, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        campaign.id,
        recipient.personId,
        recipient.email,
        hash(recipient.email.trim().toLowerCase()),
        recipient.status ?? "sent",
        token,
        hash(token),
        input.startedAt,
      ],
    );
    if (row === undefined) throw new Error("demo campaign recipient insert failed");
    await db.q(
      `INSERT INTO marketing_tokens (token_hash, purpose, person_id, campaign_recipient_id)
       VALUES ($1, 'unsub', $2, $3)`,
      [hash(token), recipient.personId, row.id],
    );
    await db.q(
      `INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type)
       VALUES ($1, $2, $3, 'delivered')`,
      [campaign.id, row.id, recipient.personId],
    );
    await insertEventsForRecipient(
      db,
      {
        campaignId: campaign.id,
        recipientId: row.id,
        personId: recipient.personId,
        emailHash: hash(recipient.email.trim().toLowerCase()),
        events: recipient.events,
      },
      totals,
    );
    totals.uniqueOpens = (totals.uniqueOpens ?? 0) + 1;
  }
  await db.q(`UPDATE campaigns SET totals = $2::jsonb WHERE id = $1`, [
    campaign.id,
    JSON.stringify(totals),
  ]);
  return { id: campaign.id, token: firstToken, totals };
}

async function insertSequence(
  db: Db,
  input: {
    ownerId: string;
    senderId: string;
    enrolledPersonIds: readonly string[];
  },
): Promise<string> {
  const [sequence] = await db.q<{ id: string }>(
    `INSERT INTO sequences (name, status, sender_id, reply_to, entry, exit, send_window, created_by)
     VALUES ($1, 'active', $2, NULL, $3::jsonb, $4::jsonb, $5::jsonb, $6)
     RETURNING id`,
    [
      SEQUENCE_NAME,
      input.senderId,
      JSON.stringify({ manual: true, automation: true, segment: null }),
      JSON.stringify({ dealWon: false, replied: false, filter: null }),
      JSON.stringify({ weekdaysOnly: false, startHour: 0, endHour: 24, timezone: "UTC" }),
      input.ownerId,
    ],
  );
  if (sequence === undefined) throw new Error("demo sequence insert failed");

  const steps = [
    {
      position: 0,
      kind: "email",
      subject: "Welcome to the demo",
      preheader: "A short welcome from the team",
      content: CAMPAIGN_STARTERS[1]?.document,
      waitMinutes: null,
    },
    {
      position: 1,
      kind: "wait",
      subject: null,
      preheader: null,
      content: null,
      waitMinutes: 2 * 24 * 60,
    },
    {
      position: 2,
      kind: "email",
      subject: "One more thing",
      preheader: "A follow-up after two days",
      content: CAMPAIGN_STARTERS[0]?.document,
      waitMinutes: null,
    },
  ];
  const stepIds: string[] = [];
  for (const step of steps) {
    const [row] = await db.q<{ id: string }>(
      `INSERT INTO sequence_steps
         (sequence_id, position, kind, subject, preheader, content, wait_minutes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id`,
      [
        sequence.id,
        step.position,
        step.kind,
        step.subject,
        step.preheader,
        step.content === undefined ? null : JSON.stringify(step.content),
        step.waitMinutes,
      ],
    );
    if (row === undefined) throw new Error("demo sequence step insert failed");
    stepIds.push(row.id);
  }

  for (const [index, stepId] of stepIds.entries()) {
    const step = steps[index];
    if (step === undefined || step.kind !== "email" || step.content === undefined) continue;
    const name = `${SEQUENCE_NAME} step ${step.position + 1}`;
    const [campaign] = await db.q<{ id: string }>(
      `INSERT INTO campaigns
         (name, type, status, subject, preheader, sender_id, content, created_by, started_at)
       VALUES ($1, 'nurture', 'sending', $2, $3, $4, $5::jsonb, $6, now() - interval '5 days')
       RETURNING id`,
      [
        name,
        step.subject,
        step.preheader,
        input.senderId,
        JSON.stringify(step.content),
        input.ownerId,
      ],
    );
    if (campaign === undefined) throw new Error("demo sequence campaign insert failed");
    await db.q(`UPDATE sequence_steps SET campaign_id = $2 WHERE id = $1`, [stepId, campaign.id]);
    await db.q(
      `INSERT INTO campaign_links (campaign_id, link_index, url_template) VALUES ($1, 0, $2)`,
      [campaign.id, "https://example.com/nurture"],
    );
    await db.q(`UPDATE campaigns SET totals = $2::jsonb WHERE id = $1`, [
      campaign.id,
      JSON.stringify({
        recipients: 0,
        sent: 0,
        delivered: 0,
        opens: 0,
        uniqueOpens: 0,
        uniqueHumanOpens: 0,
        machineOpens: 0,
        clicks: 0,
        uniqueClicks: 0,
        unsubscribes: 0,
        bouncesHard: 0,
        bouncesSoft: 0,
        complaints: 0,
      }),
    ]);
  }

  for (const personId of input.enrolledPersonIds.slice(0, 12)) {
    await db.q(
      `INSERT INTO sequence_enrollments
         (sequence_id, person_id, status, current_position, next_run_at)
       VALUES ($1, $2, 'active', 0, $3)
       ON CONFLICT DO NOTHING`,
      [sequence.id, personId, daysFromNow(30)],
    );
  }
  return sequence.id;
}

export async function seedCampaigns({ db, ownerId, personIds }: SeedArgs): Promise<{
  subscribed: number;
  sentCampaigns: number;
  sequenceEnrollments: number;
}> {
  const rng = makeRng(SEED);
  await cleanup(db);
  await subscribeSixtyPercent(db, personIds, rng);
  const senders = await insertSenders(db, ownerId);
  const newsSender = senders["demo-news@example.com"] ?? "";
  const announcementSender = senders["demo-announcements@example.com"] ?? "";
  const e2ePeople = await insertE2ePeople(db, ownerId);
  const filterId = await insertSavedFilter(db, ownerId);

  const subscribed = await db.q<{ id: string; primary_email: string }>(
    `SELECT p.id, p.primary_email
     FROM persons p
     JOIN person_marketing pm ON pm.person_id = p.id
     WHERE p.id = ANY($1::uuid[]) AND p.deleted_at IS NULL AND pm.status = 'subscribed'
     ORDER BY p.id
     LIMIT 20`,
    [personIds],
  );
  const recipients = subscribed.map((row, index) => ({
    personId: row.id,
    email: row.primary_email,
    events:
      index === 0
        ? (["open_human", "click"] as const)
        : index === 1
          ? (["open_proxy", "click"] as const)
          : index === 2
            ? (["open_human", "unsubscribe"] as const)
            : index === 3
              ? (["bounce_hard"] as const)
              : ([] as const),
  }));
  const newsletter = await insertSentCampaign(db, {
    name: "Demo newsletter",
    type: "newsletter",
    subject: "Demo newsletter: what is new",
    preheader: "A short monthly round-up",
    document: CAMPAIGN_STARTERS[0]?.document ?? {},
    senderId: newsSender,
    segmentFilterId: filterId,
    ownerId,
    startedAt: daysFromNow(-3),
    recipients,
    linkUrl: "https://example.com/newsletter",
  });
  const announcement = await insertSentCampaign(db, {
    name: "Demo announcement",
    type: "announcement",
    subject: "Demo announcement: a new feature",
    preheader: "The one thing we shipped",
    document: CAMPAIGN_STARTERS[1]?.document ?? {},
    senderId: announcementSender,
    segmentFilterId: filterId,
    ownerId,
    startedAt: daysFromNow(-1),
    recipients: recipients.slice(0, 4),
    linkUrl: "https://example.com/announcement",
  });

  await db.q(
    `INSERT INTO campaigns
       (name, type, status, subject, preheader, sender_id, segment, content, created_by, scheduled_at)
     VALUES ($1, 'announcement', 'scheduled', $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      "Demo scheduled",
      "Demo scheduled: coming soon",
      "A scheduled campaign for the gallery",
      newsSender,
      JSON.stringify({ kind: "saved_filter", savedFilterId: filterId }),
      JSON.stringify(CAMPAIGN_STARTERS[1]?.document ?? {}),
      ownerId,
      daysFromNow(2),
    ],
  );
  await db.q(
    `INSERT INTO campaigns
       (name, type, status, subject, preheader, sender_id, segment, content, created_by)
     VALUES ($1, 'newsletter', 'draft', $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      "Demo draft",
      "Demo draft: still cooking",
      "A draft for the gallery",
      newsSender,
      JSON.stringify({ kind: "saved_filter", savedFilterId: filterId }),
      JSON.stringify(CAMPAIGN_STARTERS[0]?.document ?? {}),
      ownerId,
    ],
  );

  const sequenceId = await insertSequence(db, {
    ownerId,
    senderId: newsSender,
    enrolledPersonIds: subscribed.map((row) => row.id),
  });
  const [enrollments] = await db.q<{ count: number }>(
    `SELECT count(*)::int AS count FROM sequence_enrollments WHERE sequence_id = $1`,
    [sequenceId],
  );

  mkdirSync(".e2e", { recursive: true });
  writeFileSync(
    ".e2e/campaigns.json",
    JSON.stringify({
      filterName: FILTER_NAME,
      sequenceId,
      sequenceName: SEQUENCE_NAME,
      newsletterId: newsletter.id,
      announcementId: announcement.id,
      newsletterToken: newsletter.token,
      announcementToken: announcement.token,
      e2ePeople: E2E_PEOPLE.map((name, index) => ({
        name,
        email: E2E_EMAILS[index] ?? `campaign.e2e${index + 1}@example.com`,
        personId: e2ePeople[index] ?? "",
      })),
    }),
  );

  return {
    subscribed: subscribed.length,
    sentCampaigns: 2,
    sequenceEnrollments: enrollments?.count ?? 0,
  };
}
