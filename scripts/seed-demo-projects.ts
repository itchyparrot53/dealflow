// Part 8 demo data: one project linked to a won deal with the three default phases and six tasks
// (two done), one unlinked internal project, and one read API token for the first admin. The token
// is a random secret whose plain value is never printed, so it exists only to populate the table.
// Re-runnable: rows are matched by name and reused.

import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { PROJECT_DEFAULT_PHASES } from "@/constants/projectsApi";
import * as schema from "@/db/schema";
import { hashApiToken } from "@/features/api/tokenFormat";

const LINKED = "Website relaunch";
const INTERNAL = "Internal: website refresh";
const TOKEN_NAME = "Demo token";

export async function seedProjects(args: { ownerId: string; pool: Pool }): Promise<{
  projects: number;
  tasks: number;
  tokens: number;
}> {
  const db = drizzle(args.pool, { schema });
  const [won] = await db
    .select({ id: schema.deals.id })
    .from(schema.deals)
    .where(and(eq(schema.deals.status, "won"), isNull(schema.deals.deletedAt)))
    .limit(1);

  async function ensureProject(name: string, dealId: string | null): Promise<string> {
    const [existing] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.name, name), eq(schema.projects.ownerId, args.ownerId)));
    if (existing !== undefined) return existing.id;
    const [created] = await db
      .insert(schema.projects)
      .values({
        name,
        description: name === LINKED ? "Demo project created from a won deal." : "No linked deal.",
        dealId,
        ownerId: args.ownerId,
        dueDate: sql`(now() + interval '30 days')::date`,
      })
      .returning({ id: schema.projects.id });
    if (created === undefined) throw new Error("demo project insert failed");
    await db.insert(schema.projectPhases).values(
      PROJECT_DEFAULT_PHASES.map((phase, position) => ({
        projectId: created.id,
        name: phase,
        position,
      })),
    );
    return created.id;
  }

  const linkedId = await ensureProject(LINKED, won?.id ?? null);
  const internalId = await ensureProject(INTERNAL, null);

  const phases = await db
    .select()
    .from(schema.projectPhases)
    .where(eq(schema.projectPhases.projectId, linkedId))
    .orderBy(schema.projectPhases.position);
  const kickoff = phases[0]?.id ?? null;
  const delivery = phases[1]?.id ?? null;

  const existingTasks = await db
    .select({ id: schema.projectTasks.id })
    .from(schema.projectTasks)
    .where(eq(schema.projectTasks.projectId, linkedId));
  if (existingTasks.length === 0) {
    const titles = [
      "Kickoff call",
      "Collect the brief",
      "Design homepage",
      "Build homepage",
      "Copy review",
      "Launch checklist",
    ];
    await db.insert(schema.projectTasks).values(
      titles.map((title, index) => ({
        projectId: linkedId,
        phaseId: index < 2 ? kickoff : delivery,
        title,
        assigneeId: args.ownerId,
        position: index,
        done: index < 2,
        doneAt: index < 2 ? new Date() : null,
      })),
    );
  }

  const [existingToken] = await db
    .select({ id: schema.apiTokens.id })
    .from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.userId, args.ownerId), eq(schema.apiTokens.name, TOKEN_NAME)));
  if (existingToken === undefined) {
    const token = `dfk_${randomBytes(32).toString("base64url")}`;
    await db.insert(schema.apiTokens).values({
      userId: args.ownerId,
      name: TOKEN_NAME,
      tokenHash: hashApiToken(token),
      tokenPrefix: token.slice(0, 12),
      scope: "read",
    });
  }

  const projects = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.ownerId, args.ownerId));
  const tasks = await db
    .select({ id: schema.projectTasks.id })
    .from(schema.projectTasks)
    .where(eq(schema.projectTasks.projectId, linkedId));
  return {
    projects: projects.filter((row) => row.id === linkedId || row.id === internalId).length,
    tasks: tasks.length,
    tokens: 1,
  };
}
