"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Tip } from "@/components/ui/tooltip";
import { NAV_ITEMS } from "@/constants/nav";
import { STRINGS } from "@/constants/strings";
import { BrandLogo } from "@/features/branding/BrandLogo";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./NavIcons";
import { RailToggle } from "./RailToggle";
import {
  normalizeRailState,
  RAIL_TOGGLE_EVENT,
  type RailState,
  railStateToggle,
  writeRailState,
} from "./railState";

// Pipedrive's rail, now expandable (PLAN-PART12.md 6.4): 232 px with labels by default and 56 px
// icon-only when collapsed. The server layout reads the cookie and passes the initial state, so the
// first paint already has the right width. Settings/help/profile stay in the top bar.
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

export function LeftNav({
  initialRail = "expanded",
}: {
  initialRail?: RailState;
}): React.ReactNode {
  const pathname = usePathname();
  const [rail, setRail] = useState<RailState>(normalizeRailState(initialRail));
  const collapsed = rail === "collapsed";

  const toggle = useCallback(() => {
    setRail((current) => {
      const next = railStateToggle(current);
      writeRailState(next);
      return next;
    });
  }, []);

  // The "[" shortcut lives in GlobalShortcuts, which announces the intent on this event; a user
  // toggling from the button and one toggling from the keyboard therefore share one path.
  useEffect(() => {
    const onToggle = (): void => toggle();
    window.addEventListener(RAIL_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(RAIL_TOGGLE_EVENT, onToggle);
  }, [toggle]);

  return (
    <nav
      id="app-nav"
      aria-label="Primary"
      data-testid="app-rail"
      data-state={rail}
      data-print-hide
      className={cn(
        "flex h-full shrink-0 flex-col bg-rail transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-14 items-center" : "w-[232px]",
      )}
    >
      <Link
        href="/"
        aria-label={`${STRINGS.app.name} home`}
        className={cn(
          "flex h-14 shrink-0 items-center",
          collapsed ? "w-14 justify-center" : "w-full px-4",
        )}
      >
        {collapsed ? (
          // The reverse leaf mark reads on the indigo rail (28 px per 6.7).
          <BrandLogo variant="mark" tone="reverse" height={28} />
        ) : (
          <BrandLogo variant="logo" tone="reverse" height={24} />
        )}
      </Link>
      <div className="flex w-full flex-col gap-2 pt-2">
        {ITEMS.map((item) => {
          const active = isNavActive(pathname, item.section);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex transition-colors duration-100",
                collapsed
                  ? "size-11 items-center justify-center rounded-lg"
                  : "mx-2 h-10 items-center gap-3 rounded-lg px-3",
                active
                  ? "bg-rail-active text-rail-foreground"
                  : "text-rail-foreground hover:bg-rail-hover",
              )}
            >
              <item.Icon className={collapsed ? "size-6" : "size-5"} />
              {collapsed ? null : (
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    active ? "text-rail-foreground" : "text-rail-foreground/80",
                  )}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
          // Tooltips only make sense when the label is not on screen.
          return collapsed ? (
            <Tip key={item.href} label={item.label}>
              {link}
            </Tip>
          ) : (
            link
          );
        })}
      </div>
      <div className={cn("mt-auto pb-3", collapsed ? "flex w-full justify-center" : "px-2")}>
        <RailToggle state={rail} onToggle={toggle} />
      </div>
    </nav>
  );
}
