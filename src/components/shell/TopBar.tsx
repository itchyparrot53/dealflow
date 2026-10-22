import Link from "next/link";
import type React from "react";
import { STRINGS } from "@/constants/strings";
import { AssistantLauncher } from "@/features/ai/ui/AssistantLauncher";
import { NotificationsBell } from "@/features/notifications/ui/NotificationsBell";
import { GlobalAddMenu } from "@/features/quick-add/GlobalAddMenu";
import type { Appearance } from "@/features/theme/appearance";
import { SearchTrigger } from "./SearchTrigger";
import { UserMenu } from "./UserMenu";

export function TopBar({
  userId,
  userName,
  avatarUrl,
  appearance,
}: {
  userId: string;
  userName?: string;
  avatarUrl?: string | null;
  appearance?: Appearance;
}): React.ReactNode {
  return (
    <header
      data-print-hide
      className="flex h-14 items-center gap-3 border-b bg-background px-3 md:gap-4 md:px-4"
    >
      {/* On a phone the brand gives its width to search, notifications and the avatar. */}
      <Link
        href="/pipeline"
        aria-label={`${STRINGS.app.name} home`}
        className="hidden w-44 shrink-0 text-base font-semibold tracking-tight transition-opacity hover:opacity-80 md:block"
      >
        {STRINGS.app.name}
      </Link>
      <div className="mx-auto flex w-full min-w-0 max-w-lg items-center gap-2">
        <search className="min-w-0 flex-1">
          <SearchTrigger />
        </search>
        {/* Global quick-add: opens Deal/Lead/Person/Organization create modals from any page. */}
        <div className="hidden md:block">
          <GlobalAddMenu />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 md:w-52 md:gap-3">
        <div className="hidden md:block">
          <AssistantLauncher />
        </div>
        <NotificationsBell userId={userId} />
        <UserMenu
          userId={userId}
          userName={userName}
          avatarUrl={avatarUrl}
          appearance={appearance}
        />
      </div>
    </header>
  );
}
