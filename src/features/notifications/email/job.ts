import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { AppError } from "@/constants/errorIds";
import { EMAIL_NOTIFICATION_QUEUE } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import { notifications, users } from "@/db/schema";
import { sendSystemEmail } from "@/features/email-design/sendSystemEmail";
import { canActorAccessParent } from "@/features/files/fileAuthz";
import { hydrateActor } from "@/server/hydrateActor";
import type { NotificationRow } from "@/types/notification";
import { ok, type Result } from "@/types/result";
import { resolveDelivery } from "../preferences";
import { renderNotificationEmail } from "./render";

// Notification mail leaves through the system mailer (SMTP), never through a user's mailbox,
// so a notification needs no connected account and keeps working for a user without Gmail.
export type SendFn = (
  to: string,
  variables: Record<string, string>,
  signal: AbortSignal,
) => Promise<Result<{ messageId: string }, AppError>>;

export async function runEmailNotificationJob(
  db: Db,
  data: { notificationId: string },
  signal: AbortSignal,
  deps: { send?: SendFn } = {},
): Promise<Result<{ sent: boolean }, AppError>> {
  signal.throwIfAborted();

  // (a) Load the notification row.
  const [row] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, data.notificationId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) return ok({ sent: false });

  // Idempotency guard (F36): pg-boss is at-least-once, so a job can re-run after a crash
  // between Gmail accepting the message and the job being acknowledged. If this row was
  // already emailed, skip rather than send a duplicate.
  if (row.emailSentAt !== null) return ok({ sent: false });

  const notifRow: NotificationRow = {
    id: row.id,
    userId: row.userId,
    type: row.type,
    entityType: row.entityType,
    entityId: row.entityId,
    actorId: row.actorId,
    payload: row.payload,
    readAt: row.readAt !== null ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };

  // (b) Hydrate the recipient as an AuthUser for visibility checks. Same hydrator as the request
  // path and the producer: the mailbox-owner one omits managedUserIds, which would make the
  // recheck below stricter than what the recipient can actually see and silently drop the email
  // for a team manager holding team.viewMembers.
  const recipientUser = await hydrateActor(db, notifRow.userId, signal);
  if (recipientUser === null) return ok({ sent: false }); // recipient gone or deactivated

  // (c) RE-CHECK visibility at send time: the security core.
  // A notification queued while the entity was visible may have become invisible.
  if (notifRow.entityType !== null && notifRow.entityId !== null) {
    const canSee = await canActorAccessParent(
      db,
      recipientUser,
      notifRow.entityType,
      notifRow.entityId,
      signal,
    );
    signal.throwIfAborted();
    if (canSee !== true) return ok({ sent: false }); // DROP: now-invisible
  }

  // (c2) RE-CHECK the email delivery preference at send time (F35): a preference resolved at
  // enqueue can be revoked before the job runs. If email delivery is no longer enabled for
  // this type, drop the send.
  const delivery = await resolveDelivery(db, notifRow.userId, notifRow.type, signal);
  signal.throwIfAborted();
  if (delivery.email !== true) return ok({ sent: false }); // DROP: opted out

  // (e) The recipient's name and address. Notifications go to the person, not to a mailbox row.
  const [userRow] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, notifRow.userId))
    .limit(1);
  signal.throwIfAborted();
  const recipientName = userRow?.name ?? "there";
  const recipientEmail = (userRow?.email ?? "").trim();
  if (recipientEmail === "") return ok({ sent: false });

  // (f) Render the copy, then hand the variables to the one email sender. The registry template
  // owns the layout; this job owns the type-specific subject, line and CTA.
  const copy = renderNotificationEmail(notifRow, recipientName);
  const variables = {
    "recipient.name": recipientName,
    "recipient.email": recipientEmail,
    "app.url": env.BASE_URL,
    "company.name": "",
    "notification.subject": copy.subject,
    "notification.line": copy.line,
    "notification.cta": copy.cta,
    "notification.url": copy.url,
  };

  // (g) Send through sendSystemEmail (injectable for tests).
  const send =
    deps.send ??
    ((to: string, vars: Record<string, string>, s: AbortSignal) =>
      sendSystemEmail(db, "notification", to, vars, s));
  const sent = await send(recipientEmail, variables, signal);
  if (sent.ok !== true) return sent;

  // Persist the delivery marker so a later at-least-once retry short-circuits above (F36).
  //
  // Accepted residual (F38): if the worker dies in the window between the mailer accepting the
  // message above and this marker committing, a retry re-sends. This is a deliberate
  // tradeoff, not a defect. Marking BEFORE send would instead DROP notifications on ordinary
  // transient SMTP failures (far more common than a mid-window crash), and a full
  // reconcile-by-Message-ID state machine is disproportionate for a notification email.
  await db
    .update(notifications)
    .set({ emailSentAt: new Date() })
    .where(eq(notifications.id, notifRow.id));
  signal.throwIfAborted();
  return ok({ sent: true });
}

// Register the email notification worker on pg-boss.
// Follows the exact pattern in src/features/email/workerJobs.ts.
export async function registerEmailNotificationWorker(boss: PgBoss): Promise<void> {
  const { db } = await import("@/db/client");

  await boss.createQueue(EMAIL_NOTIFICATION_QUEUE);

  await boss.work(
    EMAIL_NOTIFICATION_QUEUE,
    async ([job]: Array<{ data: { notificationId: string } }>) => {
      if (job === undefined) return;
      const signal = AbortSignal.timeout(30_000);
      const r = await runEmailNotificationJob(db, job.data, signal);
      if (r.ok !== true) {
        throw new AppError(r.error.id, "email notification job failed", {
          notificationId: job.data.notificationId,
        });
      }
    },
  );
}
