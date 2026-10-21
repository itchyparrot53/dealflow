// Part 5 demo data: two disabled automations built from the shipped templates, and one disabled
// webhook subscription pointing at an unroutable example host. Re-runnable: it replaces only rows
// whose name starts with "Demo: ".

import { encryptToken } from "@/features/email/crypto";
import type { Db } from "./seed-smoke-phase5-infra";

const NAME_PREFIX = "Demo: ";

interface AutomationArgs {
  pipelineId: string;
  ownerId: string;
}

export async function seedAutomations(
  db: Db,
  args: AutomationArgs,
): Promise<{ automations: number; webhooks: number }> {
  const stages = await db.q<{ id: string }>(
    `SELECT id FROM stages WHERE pipeline_id = $1 ORDER BY "order"`,
    [args.pipelineId],
  );
  const activity = await db.q<{ id: string }>(
    `SELECT id FROM activity_types WHERE archived_at IS NULL ORDER BY "order" LIMIT 1`,
  );
  const firstStage = stages[0]?.id;
  const lastStage = stages[stages.length - 1]?.id;
  const activityTypeId = activity[0]?.id;
  if (firstStage === undefined || lastStage === undefined || activityTypeId === undefined) {
    return { automations: 0, webhooks: 0 };
  }

  await db.q(`DELETE FROM automations WHERE name LIKE $1`, [`${NAME_PREFIX}%`]);
  await db.q(`DELETE FROM webhook_subscriptions WHERE name LIKE $1`, [`${NAME_PREFIX}%`]);

  const definitions = [
    {
      name: `${NAME_PREFIX}Onboarding call when a deal is won`,
      description: "Create an onboarding call two days after a deal is won.",
      definition: {
        trigger: { type: "deal.won" },
        condition: null,
        actions: [
          {
            type: "create_activity",
            activityTypeId,
            subject: "Onboarding call with {{person.name}}",
            dueInDays: 2,
            assignee: "deal_owner",
          },
        ],
      },
    },
    {
      name: `${NAME_PREFIX}Chase overdue invoices`,
      description: "Create a task when an invoice becomes overdue.",
      definition: {
        trigger: { type: "invoice.overdue" },
        condition: null,
        actions: [
          {
            type: "create_activity",
            activityTypeId,
            subject: "Chase invoice for {{organization.name}}",
            dueInDays: 0,
            assignee: "deal_owner",
          },
        ],
      },
    },
  ];

  for (const entry of definitions) {
    await db.q(
      `INSERT INTO automations (name, description, enabled, definition, created_by)
       VALUES ($1, $2, false, $3::jsonb, $4)`,
      [entry.name, entry.description, JSON.stringify(entry.definition), args.ownerId],
    );
  }

  await db.q(
    `INSERT INTO webhook_subscriptions
       (name, url, events, secret_enc, enabled, disabled_reason, created_by)
     VALUES ($1, $2, $3::text[], $4, false, $5, $6)`,
    [
      `${NAME_PREFIX}Example webhook`,
      "https://example.invalid/hooks/dealflow",
      ["deal.won"],
      encryptToken("whsec_demo_example_not_real"),
      "Demo",
      args.ownerId,
    ],
  );

  return { automations: definitions.length, webhooks: 1 };
}
