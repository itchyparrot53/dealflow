import type { PgBoss } from "pg-boss";
import { DISPATCH_POLL_SECONDS, DOMAIN_EVENTS_CHANNEL } from "@/constants/automations";
import { PGBOSS_QUEUE_AUTOMATION_RUN, PGBOSS_QUEUE_WEBHOOK_DELIVER } from "@/constants/jobNames";
import { type Db, db as defaultDb, pool } from "@/db/client";
import { dispatchEvents } from "./dispatcher";
import { registerRetentionJob } from "./retentionJob";
import { registerRottingJob } from "./rottingJob";

// The dispatcher runs inside the worker: a 5 s poll covers the case where a NOTIFY was missed
// (restart, dropped connection), and the LISTEN connection makes the common path immediate. One
// pass is in flight at a time; a poll that lands mid-pass is dropped, not queued.

const PASS_TIMEOUT_MS = 120_000;

let inFlight = false;

async function dispatchPass(db: Db): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    await dispatchEvents(db, AbortSignal.timeout(PASS_TIMEOUT_MS));
  } catch (error) {
    console.error("domain event dispatch failed", error);
  } finally {
    inFlight = false;
  }
}

async function listenForEvents(db: Db): Promise<void> {
  const client = await pool.connect();
  client.on("notification", () => {
    void dispatchPass(db);
  });
  client.on("error", (error: Error) => {
    console.error("domain event listener failed", error);
  });
  await client.query(`LISTEN ${DOMAIN_EVENTS_CHANNEL}`);
}

export async function registerEventJobs(boss: PgBoss): Promise<void> {
  // Queues the dispatcher fills. Their workers are registered by the features that own them
  // (automations in 2.1, webhooks in 3.1); the queue existing first means an enqueue never fails.
  await boss.createQueue(PGBOSS_QUEUE_AUTOMATION_RUN);
  await boss.createQueue(PGBOSS_QUEUE_WEBHOOK_DELIVER);
  await registerRottingJob(boss);
  await registerRetentionJob(boss);

  void dispatchPass(defaultDb);
  void listenForEvents(defaultDb).catch((error: unknown) => {
    console.error("domain event listener could not start", error);
  });
  const timer = setInterval(() => {
    void dispatchPass(defaultDb);
  }, DISPATCH_POLL_SECONDS * 1000);
  timer.unref();
}
