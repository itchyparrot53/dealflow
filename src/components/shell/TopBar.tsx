"use client";
import { CircleHelp, Info } from "lucide-react";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { USER_GUIDE_URL } from "@/constants/docs";
import { STRINGS } from "@/constants/strings";
import { AssistantLauncher } from "@/features/ai/ui/AssistantLauncher";
import { NotificationsBell } from "@/features/notifications/ui/NotificationsBell";
import { GlobalAddMenu } from "@/features/quick-add/GlobalAddMenu";
import type { Appearance } from "@/features/theme/appearance";
import { cn } from "@/lib/utils";
import { usePageTitleValue } from "./pageTitle";
import { SearchTrigger } from "./SearchTrigger";
import { UserMenu } from "./UserMenu";

// Pipedrive's 56 px top bar: the page title at left (16/600, with an info tooltip when the page
// supplies one), then the search pill, round add button and AI pill, then notifications, help and
// the 40 px initials avatar. The title lives here, not in the content.
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
  const { title, info } = usePageTitleValue();
  return (
    <header
      data-testid="top-bar"
      data-print-hide
      className="flex h-14 shrink-0 items-center gap-3 border-b border-topbar-border bg-background pl-4 pr-2 md:gap-4 md:pl-6 md:pr-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <h1
          data-testid="page-title"
          className="min-w-0 truncate text-base font-semibold text-foreground"
        >
          {title}
        </h1>
        {info === undefined ? null : (
          <Tip label={info}>
            <button
              type="button"
              aria-label="Page information"
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Info aria-hidden="true" className="size-4" />
            </button>
          </Tip>
        )}
      </div>

      <div className={cn("flex shrink-0 items-center gap-4", "min-w-0")}>
        <search className="min-w-0">
          <SearchTrigger />
        </search>
        <GlobalAddMenu />
        <div className="hidden md:block">
          <AssistantLauncher />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationsBell userId={userId} />
        <a
          href={USER_GUIDE_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={STRINGS.nav.docs}
          className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground"
        >
          <CircleHelp aria-hidden="true" className="size-5" />
        </a>
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
