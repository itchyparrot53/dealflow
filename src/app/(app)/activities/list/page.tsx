import { redirect } from "next/navigation";
import { PageTitle } from "@/components/shell/pageTitle";
import { STRINGS } from "@/constants/strings";
import { db } from "@/db/client";
import { ActivitiesTable } from "@/features/activities/ActivitiesTable";
import { ExportButton } from "@/features/export/ui/ExportButton";
import { getPreferences } from "@/features/identity/preferencesRepo";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export const metadata = { title: STRINGS.nav.activities };

// The Activities to-do list (Pipedrive parity): a table with List/Calendar toggle, an
// owner/completed/date-range filter toolbar, type tabs driven by listTypes, and a done checkbox.
// ActivitiesTable fetches its own data via tRPC (activities.listRows), so this page only guards
// auth and renders it.
export default async function ActivityListPage(): Promise<React.ReactNode> {
  const ctx = await createContext();
  if (ctx.actor === null) {
    redirect("/login");
  }
  const prefs = await getPreferences(db, ctx.actor.id, new AbortController().signal);
  return (
    <main aria-label="Activities" className="h-full">
      <PageTitle title="Activities" />
      <div className="flex justify-end p-2">
        {can(ctx.actor, "data.export") && (
          <ExportButton
            entity="activities"
            columns={["subject", "typeKey", "done", "dueAt", "assigneeName", "dealTitle"]}
          />
        )}
      </div>
      <ActivitiesTable currentUserId={ctx.actor.id} initialColumns={prefs.ui.activitiesView} />
    </main>
  );
}
