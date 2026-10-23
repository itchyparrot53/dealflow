"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActionError } from "@/components/shell/ActionErrorProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { STRINGS } from "@/constants/strings";
import { markAllReadAction, markReadAction } from "@/features/notifications/actions";
import { trpc } from "@/lib/trpc-client";
import type { NotificationFeedItem } from "@/types/notification";
import { readCsrfToken } from "@/utils/csrfCookie";
import { notificationHref } from "./deepLink";
import { NotificationItem } from "./NotificationItem";
import { useNotificationStream } from "./useNotificationStream";

// 6.8: the bell never renders a three-digit badge; above nine it reads 9+.
export function notificationBadgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export function NotificationsBell({ userId }: { userId: string }): React.ReactNode {
  useNotificationStream(userId);
  const router = useRouter();
  const utils = trpc.useUtils();
  const reportError = useActionError();
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const countQuery = trpc.notifications.unreadCount.useQuery();
  const feedQuery = trpc.notifications.feed.useQuery({ limit: 50 });

  const feed = feedQuery.data ?? [];
  const unreadCount = countQuery.data ?? 0;
  const today = feed.filter((n) => n.band === "today");
  const earlier = feed.filter((n) => n.band === "earlier");

  async function handleOpen(item: NotificationFeedItem): Promise<void> {
    if (item.readAt === null) {
      const result = await markReadAction({ id: item.id }, readCsrfToken());
      if (result.ok) {
        void utils.notifications.feed.invalidate();
        void utils.notifications.unreadCount.invalidate();
      }
    }
    setOpen(false);
    router.push(notificationHref(item));
  }

  async function handleMarkAll(): Promise<void> {
    setMarkingAll(true);
    const result = await markAllReadAction(readCsrfToken());
    setMarkingAll(false);
    if (result.ok) {
      void utils.notifications.feed.invalidate();
      void utils.notifications.unreadCount.invalidate();
    } else {
      reportError(result.error.id);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={STRINGS.notifications.title}
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-destructive-foreground ring-2 ring-background">
            {/* design-ok: badge digit */}
            {notificationBadgeText(unreadCount)}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{STRINGS.notifications.title}</span>
          <button
            type="button"
            disabled={markingAll || unreadCount === 0}
            onClick={() => void handleMarkAll()}
            className="text-sm text-info disabled:bg-disabled disabled:text-disabled-foreground hover:underline"
          >
            {STRINGS.notifications.markAllRead}
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {feed.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {STRINGS.notifications.empty}
            </p>
          ) : null}

          {today.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-2 text-meta font-semibold text-muted-foreground">
                {STRINGS.notifications.today}
              </p>
              {today.map((n) => (
                <NotificationItem key={n.id} item={n} onOpen={(item) => void handleOpen(item)} />
              ))}
            </>
          ) : null}

          {earlier.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-2 text-meta font-semibold text-muted-foreground">
                {STRINGS.notifications.earlier}
              </p>
              {earlier.map((n) => (
                <NotificationItem key={n.id} item={n} onOpen={(item) => void handleOpen(item)} />
              ))}
            </>
          ) : null}
        </div>

        <div className="border-t">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/activities/calendar");
            }}
            className="w-full px-3 py-2 text-center text-xs text-link hover:underline"
          >
            {STRINGS.notifications.seeAll}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
