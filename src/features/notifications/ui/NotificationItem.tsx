"use client";

import { notificationLabel } from "@/features/notifications/labels";
import type { NotificationFeedItem } from "@/types/notification";

export function NotificationItem({
  item,
  onOpen,
}: {
  item: NotificationFeedItem;
  onOpen: (item: NotificationFeedItem) => void;
}): React.ReactNode {
  const unread = item.readAt === null;
  const text = notificationLabel(item.type, item.payload);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={
        unread
          ? "flex w-full items-center gap-2 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50"
          : "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
      }
    >
      {unread ? (
        <span data-testid="unread-dot" className="size-2 flex-shrink-0 rounded-full bg-blue-500" />
      ) : null}
      <span className="truncate text-sm">{text}</span>
    </button>
  );
}
