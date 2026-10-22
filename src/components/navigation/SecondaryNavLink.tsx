import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { cn } from "@/lib/utils";

// Shared secondary-rail row used by Settings and Contacts. Keeping the complete row treatment in
// one component prevents icon, active-state, typography, and spacing drift between app sections.
export function SecondaryNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}): React.ReactNode {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md border-l-[3px] border-l-transparent pl-4 pr-2 text-sm transition-colors duration-100",
        active
          ? "border-l-info bg-info-soft font-medium text-info"
          : "font-normal text-foreground hover:bg-muted",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("h-4 w-4 shrink-0", active ? "" : "text-muted-foreground")}
      />
      {label}
    </Link>
  );
}
