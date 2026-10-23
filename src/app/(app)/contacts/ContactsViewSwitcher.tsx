"use client";
import { Building2, History, Users } from "lucide-react";
import type React from "react";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { STRINGS } from "@/constants/strings";

// Part 12, U13: People / Organizations / Timeline are a segmented view switcher in the page
// toolbar, not a second left rail. The rows are links to the same routes, so nothing about the
// sections changed; only their control moved.
export function ContactsViewSwitcher({
  value,
}: {
  value: "people" | "orgs" | "timeline";
}): React.ReactNode {
  return (
    <ViewSwitcher
      label="Contacts view"
      value={value}
      onChange={() => undefined}
      options={[
        {
          value: "people",
          label: STRINGS.nav.people,
          icon: <Users aria-hidden="true" />,
          href: "/contacts/people",
        },
        {
          value: "orgs",
          label: STRINGS.nav.orgs,
          icon: <Building2 aria-hidden="true" />,
          href: "/contacts/orgs",
        },
        {
          value: "timeline",
          label: STRINGS.nav.contactsTimeline,
          icon: <History aria-hidden="true" />,
          href: "/contacts/timeline",
        },
      ]}
    />
  );
}
