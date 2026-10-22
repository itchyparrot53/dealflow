"use client";
import Link from "next/link";
import type React from "react";
import { NAV_ICONS } from "@/components/shell/NavIcons";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/constants/nav";
import { STRINGS } from "@/constants/strings";
import { BrandLogo } from "@/features/branding/BrandLogo";

// Everything the bottom bar cannot fit, on the shadcn Sheet (focus trap, Escape, scroll lock).
// Settings is included because it is one of the main nav items and would otherwise be unreachable
// from a phone.
const SECONDARY = NAV_ITEMS.filter(
  (item) =>
    item.href !== "/pipeline" &&
    item.href !== "/activities" &&
    item.href !== "/inbox" &&
    item.href !== "/contacts/people",
).map((item) => ({
  href: item.href,
  label: STRINGS.nav[item.key],
  Icon: NAV_ICONS[item.key],
}));

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactNode {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="more-sheet"
        aria-label="More navigation"
        className="max-w-xs border-l bg-card p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-3 bg-rail px-5 py-4">
          <BrandLogo variant="logo" tone="reverse" height={24} />
          <SheetTitle className="text-base font-semibold text-rail-foreground">More</SheetTitle>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 pb-6">
          {SECONDARY.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => onOpenChange(false)}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-100 hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
