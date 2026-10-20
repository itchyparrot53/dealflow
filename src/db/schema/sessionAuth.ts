import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./identity";

// How the current session signed in. The password change uses it to allow a recent email-link
// sign-in to set a new password without knowing the old one (a forgotten-password recovery path),
// while an ordinary password session still has to prove the current password.
export const sessionAuthEvents = pgTable("session_auth_events", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  method: text("method").notNull().$type<"password" | "magic_link" | "invite">(),
  authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).notNull().defaultNow(),
});
