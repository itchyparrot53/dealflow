import type { ReactNode } from "react";
import { PERMISSION_FLAGS } from "@/constants/permissionFlags";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsNav } from "./SettingsNav";

// Wraps every /settings/* page with the grouped left secondary menu (Pipedrive settings IA).
// Company-overview items are shown only to admins / managers.
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const { actor } = await createContext();
  const isAdmin = actor !== null && actor.type === "admin";
  const canManageCompany =
    actor !== null && (actor.type === "admin" || actor.flags.has(PERMISSION_FLAGS.MANAGE));
  const canImport = actor !== null && can(actor, "data.import");
  return (
    <div className="flex gap-6">
      {/* 240 px nav, sticky inside the shell. The scroll container is the content column, so a
          settings page always scrolls without clipping (6.6, U12). The 16 px main padding is why
          the height is 100dvh minus 88: the 56 px top bar plus that padding. */}
      <div className="sticky top-0 hidden h-[calc(100dvh-88px)] shrink-0 overflow-y-auto md:block">
        <SettingsNav isAdmin={isAdmin} canManageCompany={canManageCompany} canImport={canImport} />
      </div>
      <div
        data-testid="settings-scroll"
        className="h-[calc(100dvh-88px)] min-w-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[960px] px-8 py-6">{children}</div>
      </div>
    </div>
  );
}
