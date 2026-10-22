"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { NAV_ITEMS } from "@/constants/nav";
import { STRINGS } from "@/constants/strings";
import { BrandLogo } from "@/features/branding/BrandLogo";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./NavIcons";

// Pipedrive's rail: 56 px wide, full viewport height, icon-only 44x44 tiles with a tooltip label,
// an indigo ground and a violet active tile. Settings/help/profile live in the top bar now, so the
// rail only carries the destinations themselves.
const ITEMS = NAV_ITEMS.filter((item) => item.key !== "settings").map((item) => ({
  ...item,
  label: STRINGS.nav[item.key],
  Icon: NAV_ICONS[item.key],
}));

// The deal workspace lives at /deals/{id} but belongs to the pipeline destination, so the rail
// still shows an active tile there (and there is always exactly one active tile).
export function isNavActive(pathname: string, section: string): boolean {
  if (pathname === section || pathname.startsWith(`${section}/`)) return true;
  if (section === "/pipeline") return pathname === "/deals" || pathname.startsWith("/deals/");
  return false;
}

export function LeftNav(): React.ReactNode {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      data-testid="app-rail"
      data-print-hide
      className="flex h-full w-14 shrink-0 flex-col items-center bg-rail"
    >
      <Link
        href="/"
        aria-label={`${STRINGS.app.name} home`}
        className="flex size-14 shrink-0 items-center justify-center"
      >
        {/* The reverse leaf mark reads on the indigo rail (28 px per 6.7). */}
        <BrandLogo variant="mark" tone="reverse" height={28} />
      </Link>
      <div className="flex flex-col items-center gap-2 pt-2">
        {ITEMS.map((item) => {
          const active = isNavActive(pathname, item.section);
          return (
            <Tip key={item.href} label={item.label}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg transition-colors duration-100",
                  active
                    ? "bg-rail-active text-rail-foreground"
                    : "text-rail-foreground hover:bg-rail-hover",
                )}
              >
                <item.Icon className="size-6" />
              </Link>
            </Tip>
          );
        })}
      </div>
    </nav>
  );
}
