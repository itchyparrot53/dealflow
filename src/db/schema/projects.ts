import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./identity";
import { organizations } from "./organizations";
import { persons } from "./persons";

// Part 8 Projects. A project groups phases and tasks and may be linked to a deal, organization
// and person. Deleting a project is a soft delete (deleted_at) so the recycle bin can restore it;
// phases and tasks cascade from the project row and are only removed by the 30-day purge.

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    // Restrict, not cascade: a project outlives a deactivated user only once it is reassigned.
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("projects_deal_idx").on(t.dealId),
    index("projects_owner_status_idx").on(t.ownerId, t.status).where(sql`${t.deletedAt} is null`),
    check("projects_name_ck", sql`char_length(${t.name}) between 1 and 150`),
    check("projects_description_ck", sql`char_length(${t.description}) <= 5000`),
    check("projects_status_ck", sql`${t.status} in ('active','on_hold','completed','cancelled')`),
  ],
);

export const projectPhases = pgTable(
  "project_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    index("project_phases_project_position_idx").on(t.projectId, t.position),
    check("project_phases_name_ck", sql`char_length(${t.name}) between 1 and 80`),
  ],
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Deleting a phase leaves its tasks in the board's "No phase" column.
    phaseId: uuid("phase_id").references(() => projectPhases.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("project_tasks_board_idx").on(t.projectId, t.phaseId, t.position),
    index("project_tasks_assignee_idx").on(t.assigneeId, t.done),
    check("project_tasks_title_ck", sql`char_length(${t.title}) between 1 and 200`),
    check("project_tasks_description_ck", sql`char_length(${t.description}) <= 5000`),
  ],
);

export type Project = typeof projects.$inferSelect;
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
