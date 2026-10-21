import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTOMATION_MAX_DEPTH } from "@/constants/automations";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  automationRuns,
  automations,
  deals,
  domainEvents,
  notifications,
  organizations,
  persons,
  projects,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { runAutomation } from "@/features/automations/runner";
import { createAutomation } from "@/features/automations/service";
import { AUTOMATION_TEMPLATES, buildTemplateContext } from "@/features/automations/templates";
import { markWon } from "@/features/deal-workspace/wonLost";
import { dispatchEvents } from "@/features/events/dispatcher";
import { buildEventPayload } from "@/features/events/snapshot";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { createProjectFromDeal } from "./fromDeal";
import { addPhase, deletePhase } from "./phases";
import {
  createProject,
  getProject,
  listProjects,
  setProjectStatus,
  updateProject,
} from "./projects";
import { addTask, completeTask, moveTask, updateTask } from "./tasks";

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;
let other: PermSetUser;
let pipelineId: string;
let stageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

function actor(row: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function seedDeal(opts: {
  title?: string;
  ownerId: string;
  visibilityLevel?: "all" | "owner" | "group";
  status?: "open" | "won";
}): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: opts.title ?? "Project deal",
      pipelineId,
      stageId,
      ownerId: opts.ownerId,
      visibilityLevel: opts.visibilityLevel ?? "all",
      boardPosition: "0",
      status: opts.status ?? "open",
    })
    .returning();
  if (row === undefined) throw new Error("deal seed failed");
  return row;
}

async function dispatchAndRun(rounds = 1): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await dispatchEvents(h.db, sig());
    const running = await h.db
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(eq(automationRuns.status, "running"));
    for (const run of running) await runAutomation(h.db, run.id, sig());
  }
}

beforeAll(async () => {
  h = await makeTestDb();
  admin = actor(await seedUser(h.db, { isAdmin: true, name: "Ada Admin" }));
  regular = actor(await seedUser(h.db, { name: "Rita Regular" }));
  other = actor(await seedUser(h.db, { name: "Otis Other" }));
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(automations);
  await h.db
    .update(domainEvents)
    .set({ processedAt: new Date() })
    .where(isNull(domainEvents.processedAt));
});

describe("projects service", () => {
  it("creates a project with the three default phases in order", async () => {
    const result = await createProject(h.db, admin, { name: "Launch" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phases.map((phase) => phase.name)).toEqual([
      "Kickoff",
      "Delivery",
      "Wrap-up",
    ]);
    expect(result.value.phases.map((phase) => phase.position)).toEqual([0, 1, 2]);
    expect(result.value.ownerId).toBe(admin.id);
    expect(result.value.status).toBe("active");
  });

  it("moves a task between phases and renumbers both columns", async () => {
    const project = await createProject(h.db, admin, { name: "Board" }, sig());
    if (!project.ok) throw new Error("project create failed");
    const phases = project.value.phases;
    const kickoff = phases[0]?.id ?? "";
    const delivery = phases[1]?.id ?? "";

    const created: string[] = [];
    for (const title of ["One", "Two", "Three"]) {
      const task = await addTask(h.db, admin, project.value.id, { phaseId: kickoff, title }, sig());
      if (!task.ok) throw new Error("task create failed");
      created.push(task.value.id);
    }

    const moved = await moveTask(
      h.db,
      admin,
      project.value.id,
      { taskId: created[0], phaseId: delivery, position: 0 },
      sig(),
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(
      moved.value.filter((task) => task.phaseId === delivery).map((task) => task.title),
    ).toEqual(["One"]);
    expect(
      moved.value.filter((task) => task.phaseId === kickoff).map((task) => task.position),
    ).toEqual([0, 1]);

    const reordered = await moveTask(
      h.db,
      admin,
      project.value.id,
      { taskId: created[1], phaseId: delivery, position: 0 },
      sig(),
    );
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    expect(
      reordered.value.filter((task) => task.phaseId === delivery).map((task) => task.title),
    ).toEqual(["Two", "One"]);
    expect(
      reordered.value.filter((task) => task.phaseId === delivery).map((task) => task.position),
    ).toEqual([0, 1]);
  });

  it("deletes a phase and leaves its tasks with no phase", async () => {
    const project = await createProject(h.db, admin, { name: "Phases" }, sig());
    if (!project.ok) throw new Error("project create failed");
    const phase = project.value.phases[0]?.id ?? "";
    const task = await addTask(
      h.db,
      admin,
      project.value.id,
      { phaseId: phase, title: "Loose" },
      sig(),
    );
    if (!task.ok) throw new Error("task create failed");

    const deleted = await deletePhase(h.db, admin, project.value.id, { phaseId: phase }, sig());
    expect(deleted.ok).toBe(true);
    const view = await getProject(h.db, admin, project.value.id, sig());
    if (!view.ok) throw new Error("project read failed");
    expect(view.value.tasks[0]?.phaseId).toBeNull();
    expect(view.value.phases.map((ph) => ph.id)).not.toContain(phase);

    const added = await addPhase(h.db, admin, project.value.id, { name: "Again" }, sig());
    expect(added.ok).toBe(true);
  });

  it("completing sets completed_at and emits project.status_changed; another status clears it", async () => {
    const project = await createProject(h.db, admin, { name: "Status" }, sig());
    if (!project.ok) throw new Error("project create failed");

    const completed = await setProjectStatus(h.db, admin, project.value.id, "completed", sig());
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.value.completedAt).not.toBeNull();

    const events = await h.db
      .select()
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.type, "project.status_changed"),
          eq(domainEvents.entityId, project.value.id),
        ),
      );
    expect(events).toHaveLength(1);
    expect(events[0]?.changes).toEqual([{ field: "status", old: "active", new: "completed" }]);

    const reopened = await setProjectStatus(h.db, admin, project.value.id, "active", sig());
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.completedAt).toBeNull();
  });

  it("notifies another assignee once and never notifies the actor", async () => {
    const project = await createProject(h.db, admin, { name: "Notify" }, sig());
    if (!project.ok) throw new Error("project create failed");
    const phase = project.value.phases[0]?.id ?? "";

    const assigned = await addTask(
      h.db,
      admin,
      project.value.id,
      { phaseId: phase, title: "Write the spec", assigneeId: regular.id },
      sig(),
    );
    expect(assigned.ok).toBe(true);
    const rows = await h.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "project_task_assigned"),
          eq(notifications.entityId, project.value.id),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(regular.id);
    expect(rows[0]?.payload).toMatchObject({ taskTitle: "Write the spec", projectName: "Notify" });

    const selfAssigned = await addTask(
      h.db,
      admin,
      project.value.id,
      { phaseId: phase, title: "Mine", assigneeId: admin.id },
      sig(),
    );
    expect(selfAssigned.ok).toBe(true);
    const afterSelf = await h.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "project_task_assigned"),
          eq(notifications.entityId, project.value.id),
        ),
      );
    expect(afterSelf).toHaveLength(1);

    if (!assigned.ok) return;
    const reassigned = await updateTask(
      h.db,
      admin,
      project.value.id,
      { taskId: assigned.value.id, assigneeId: other.id },
      sig(),
    );
    expect(reassigned.ok).toBe(true);
    const afterReassign = await h.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "project_task_assigned"),
          eq(notifications.entityId, project.value.id),
        ),
      );
    expect(afterReassign.map((row) => row.userId).sort()).toEqual([regular.id, other.id].sort());
  });

  it("hides a project linked to a private deal from a user who cannot see the deal", async () => {
    const deal = await seedDeal({ ownerId: regular.id, visibilityLevel: "owner" });
    const project = await createProject(
      h.db,
      admin,
      { name: "Private deal project", dealId: deal.id },
      sig(),
    );
    expect(project.ok).toBe(true);
    if (!project.ok) return;

    const ownerView = await getProject(h.db, regular, project.value.id, sig());
    expect(ownerView.ok).toBe(true);
    const outsider = await getProject(h.db, other, project.value.id, sig());
    expect(outsider.ok).toBe(false);
    if (outsider.ok) return;
    expect(outsider.error.id).toBe(ERROR_IDS.PROJECT_NOT_FOUND);

    const filtered = await listProjects(h.db, other, { dealId: deal.id }, sig());
    expect(filtered).toEqual([]);
    const visible = await listProjects(h.db, regular, { dealId: deal.id }, sig());
    expect(visible.map((row) => row.id)).toEqual([project.value.id]);
  });

  it("refuses an edit by someone who is not owner, assignee or admin, then allows the assignee", async () => {
    const project = await createProject(h.db, admin, { name: "Permissions" }, sig());
    if (!project.ok) throw new Error("project create failed");

    const denied = await updateProject(h.db, regular, project.value.id, { name: "Nope" }, sig());
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.id).toBe(ERROR_IDS.PROJECT_FORBIDDEN);

    const phase = project.value.phases[0]?.id ?? "";
    const task = await addTask(
      h.db,
      admin,
      project.value.id,
      { phaseId: phase, title: "Assignee task", assigneeId: regular.id },
      sig(),
    );
    expect(task.ok).toBe(true);

    const allowed = await updateProject(
      h.db,
      regular,
      project.value.id,
      { name: "Renamed" },
      sig(),
    );
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.value.name).toBe("Renamed");
  });

  it("completing a task emits project_task.completed with the project and task snapshot", async () => {
    const project = await createProject(h.db, admin, { name: "Snapshot" }, sig());
    if (!project.ok) throw new Error("project create failed");
    const phase = project.value.phases[0]?.id ?? "";
    const task = await addTask(
      h.db,
      admin,
      project.value.id,
      { phaseId: phase, title: "Finish" },
      sig(),
    );
    if (!task.ok) throw new Error("task create failed");

    const done = await completeTask(
      h.db,
      admin,
      project.value.id,
      { taskId: task.value.id },
      sig(),
    );
    expect(done.ok).toBe(true);

    const [event] = await h.db
      .select()
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.type, "project_task.completed"),
          eq(domainEvents.entityId, project.value.id),
        ),
      );
    expect(event).toBeDefined();
    if (event === undefined) return;
    const payload = await buildEventPayload(
      h.db,
      {
        eventId: event.id,
        type: "project_task.completed",
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
        changes: event.changes as { field: string; old: unknown; new: unknown }[],
        createdAt: event.createdAt,
      },
      sig(),
    );
    expect(payload.data).toMatchObject({
      project: { id: project.value.id, name: "Snapshot" },
      task: { id: task.value.id, title: "Finish" },
    });
  });
});

describe("create a project from a won deal", () => {
  it("creates a linked project named after the won deal", async () => {
    const [person] = await h.db
      .insert(persons)
      .values({
        name: "Pat Person",
        ownerId: regular.id,
        visibilityLevel: "all",
      })
      .returning();
    const [org] = await h.db
      .insert(organizations)
      .values({ name: "Acme", ownerId: regular.id, visibilityLevel: "all" })
      .returning();
    const [deal] = await h.db
      .insert(deals)
      .values({
        title: "Onboarding retainer",
        pipelineId,
        stageId,
        ownerId: regular.id,
        personId: person?.id ?? null,
        orgId: org?.id ?? null,
        visibilityLevel: "all",
        boardPosition: "0",
        status: "won",
      })
      .returning();
    if (deal === undefined) throw new Error("deal seed failed");

    const result = await createProjectFromDeal(h.db, admin, deal.id, {}, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Onboarding retainer");
    expect(result.value.dealId).toBe(deal.id);
    expect(result.value.personId).toBe(person?.id ?? null);
    expect(result.value.organizationId).toBe(org?.id ?? null);
    expect(result.value.ownerId).toBe(regular.id);
  });

  it("refuses an open deal on the user path with E_PROJECT_004", async () => {
    const deal = await seedDeal({ ownerId: admin.id });
    const result = await createProjectFromDeal(h.db, admin, deal.id, {}, sig());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.PROJECT_INPUT_INVALID);
    expect(result.error.context).toMatchObject({ reason: "deal_not_won" });
  });

  it("runs the project-on-won template end to end and the chain guard bounds a create loop", async () => {
    const context = await buildTemplateContext(h.db, sig());
    expect(context).not.toBeNull();
    if (context === null) return;
    const template = AUTOMATION_TEMPLATES.find((entry) => entry.key === "project-on-won");
    expect(template).toBeDefined();
    if (template === undefined) return;
    const definition = template.build(context);
    const created = await createAutomation(
      h.db,
      admin,
      { name: template.name, definition, enabled: true },
      sig(),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // A second automation turns every new project into another project on the same deal, so the
    // only thing that can stop it is the chain guard.
    const loop = await createAutomation(
      h.db,
      admin,
      {
        name: "Loop",
        enabled: true,
        definition: {
          trigger: { type: "project.created" },
          condition: null,
          actions: [{ type: "create_project" }],
        },
      },
      sig(),
    );
    expect(loop.ok).toBe(true);

    const deal = await seedDeal({ title: "Won for project", ownerId: admin.id });
    const won = await markWon(h.db, admin, deal.id, sig());
    expect(won.ok).toBe(true);
    await dispatchAndRun(6);

    const rows = await h.db.select().from(projects).where(eq(projects.dealId, deal.id));
    // The template alone makes one; the loop can add at most one more per allowed chain depth.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(AUTOMATION_MAX_DEPTH + 2);
    expect(rows.some((row) => row.name === "Won for project")).toBe(true);

    const before = rows.length;
    await dispatchAndRun(3);
    const after = await h.db.select().from(projects).where(eq(projects.dealId, deal.id));
    expect(after.length).toBe(before);
  });
});
