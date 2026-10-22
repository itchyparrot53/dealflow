"use client";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { ActivitiesIcon, InboxIcon, NAV_ICONS, PipelineIcon } from "@/components/shell/NavIcons";
import { STRINGS } from "@/constants/strings";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./MoreSheet";

// Below the mobile breakpoint the left rail is replaced by this five-item bar: the four screens
// people use on a phone, plus More for everything else. The breakpoint lives in one constant so
// the CSS and the safe-area padding cannot drift apart.
const PRIMARY = [
  { href: "/pipeline", label: STRINGS.nav.deals, Icon: PipelineIcon },
  { href: "/activities", label: STRINGS.nav.activities, Icon: ActivitiesIcon },
  { href: "/inbox", label: STRINGS.nav.inbox, Icon: InboxIcon },
  { href: "/contacts/people", label: STRINGS.nav.contacts, Icon: NAV_ICONS.contacts },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/contacts/people") return pathname.startsWith("/contacts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav(): React.ReactNode {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        data-testid="bottom-nav"
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {PRIMARY.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                data-testid="bottom-nav-item"
                data-href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-foreground")} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            data-testid="bottom-nav-item"
            data-href="more"
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium",
              moreOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
