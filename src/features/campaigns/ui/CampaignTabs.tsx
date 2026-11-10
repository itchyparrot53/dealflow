import type React from "react";

// The Campaigns view switcher. Templates and Insights stay inside the Campaigns page for now; the
// Automated list is its own route because its editor lives under /campaigns/automated/[id].
export function CampaignTabs({ active }: { active: "campaigns" | "automated" }): React.ReactNode {
  const tabs = [
    { key: "campaigns", label: "Campaigns", href: "/campaigns" },
    { key: "automated", label: "Automated", href: "/campaigns/automated" },
  ] as const;
  return (
    <nav className="flex gap-1 border-b" aria-label="Campaign views">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`px-3 py-2 text-sm ${
            active === tab.key ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
