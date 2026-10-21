import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { findDuplicatePairs } from "@/features/duplicates/find";
import { DuplicatesPage } from "@/features/duplicates/ui/DuplicatesPage";
import { createContext } from "@/server/trpc/context";

export const metadata = { title: "Possible duplicates" };

// Duplicate finder page (6.7). Both scans run on the server with the actor's visibility, so the
// browser never receives a record the actor cannot see.
export default async function DuplicatesRoute(): Promise<React.ReactNode> {
  const ctx = await createContext();
  if (ctx.actor === null) {
    redirect("/login");
  }
  const signal = new AbortController().signal;
  const [people, organizations] = await Promise.all([
    findDuplicatePairs(db, ctx.actor, "person", signal),
    findDuplicatePairs(db, ctx.actor, "organization", signal),
  ]);
  return (
    <main aria-label="Possible duplicates" className="p-4">
      <DuplicatesPage
        people={people.pairs}
        organizations={organizations.pairs}
        capped={people.capped || organizations.capped}
      />
    </main>
  );
}
