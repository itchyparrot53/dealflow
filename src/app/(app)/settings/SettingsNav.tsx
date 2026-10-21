"use client";
import {
  Bell,
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  Coins,
  Database,
  Eye,
  FileText,
  KeyRound,
  type LucideIcon,
  Mail,
  MailCheck,
  Package,
  Plug,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  Trash2,
  Upload,
  User,
  Users,
  UsersRound,
  Webhook,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { SecondaryNavLink } from "@/components/navigation/SecondaryNavLink";
import { AI_STRINGS } from "@/constants/aiStrings";
import { AUTOMATIONS_STRINGS, WEBHOOKS_STRINGS } from "@/constants/automationsStrings";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ENRICHMENT_STRINGS } from "@/constants/enrichmentStrings";
import { BOOKING_STRINGS, FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { CURRENCY_STRINGS, PRODUCTS_STRINGS } from "@/constants/salesStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { STRINGS } from "@/constants/strings";

interface NavItem {
  href: string;
  label: string;
  // Leading glyph, matching Pipedrive's settings menu (each row is icon + label).
  icon: LucideIcon;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const MY_ACCOUNT: NavSection = {
  title: STRINGS.settings.myAccount,
  items: [
    { href: "/settings/profile", label: STRINGS.settings.profile, icon: User },
    { href: "/settings/notifications", label: STRINGS.settings.notifications, icon: Bell },
    { href: "/settings/email-sync", label: STRINGS.settings.emailSync, icon: MailCheck },
    { href: "/settings/email", label: STRINGS.settings.emailTemplates, icon: Mail },
    { href: "/settings/connections", label: STRINGS.settings.connectedApps, icon: Plug },
    // Every user creates and revokes their own API tokens.
    { href: "/settings/api", label: PROJECTS_API_STRINGS.api.nav, icon: KeyRound },
    // Every user can restore what they own or deleted.
    {
      href: "/settings/recycle-bin",
      label: PROJECTS_API_STRINGS.recycle.nav,
      icon: Trash2,
    },
    // Every user manages their own booking pages, so this one is not admin-only.
    { href: "/settings/booking", label: BOOKING_STRINGS.nav, icon: CalendarClock },
  ],
};

// Company items need the MANAGE flag (or admin); hidden, not disabled, for everyone else.
const COMPANY: NavSection = {
  title: STRINGS.settings.companyOverview,
  items: [
    { href: "/settings/company", label: STRINGS.settings.companySettings, icon: Building2 },
    { href: "/settings/currencies", label: CURRENCY_STRINGS.title, icon: Coins },
    { href: "/settings/products", label: PRODUCTS_STRINGS.title, icon: Package },
    { href: "/settings/documents", label: DOCUMENTS_STRINGS.title, icon: FileText },
    { href: "/settings/users", label: STRINGS.settings.users, icon: Users },
    { href: "/settings/teams", label: STRINGS.settings.teams, icon: UsersRound },
    { href: "/settings/goals", label: SETTINGS_STRINGS.goals, icon: Target },
    {
      href: "/settings/permission-sets",
      label: STRINGS.settings.permissionSets,
      icon: ShieldCheck,
    },
    { href: "/settings/visibility-groups", label: STRINGS.settings.visibilityGroups, icon: Eye },
    { href: "/settings/fields", label: STRINGS.settings.dataFields, icon: Table2 },
  ],
};

// The enrichment page, its config query and its settings actions all require a real admin, so the
// MANAGE flag alone must not surface this link.
const ENRICHMENT_ITEM: NavItem = {
  href: "/settings/enrichment",
  label: ENRICHMENT_STRINGS.nav,
  icon: Sparkles,
};

// Automations and webhooks are admin-only; the pages gate on the capability, and the nav hides
// the links for everyone else.
const AUTOMATIONS_ITEM: NavItem = {
  href: "/settings/automations",
  label: AUTOMATIONS_STRINGS.title,
  icon: Bot,
};
const BACKUPS_ITEM: NavItem = {
  href: "/settings/backups",
  label: PROJECTS_API_STRINGS.backups.nav,
  icon: Database,
};
const AUDIT_ITEM: NavItem = {
  href: "/settings/audit-log",
  label: PROJECTS_API_STRINGS.audit.nav,
  icon: ClipboardList,
};
const WEBHOOKS_ITEM: NavItem = {
  href: "/settings/webhooks",
  label: WEBHOOKS_STRINGS.title,
  icon: Webhook,
};
// Public forms create leads or deals, so building one is an admin surface.
const FORMS_ITEM: NavItem = {
  href: "/settings/forms",
  label: FORMS_STRINGS.title,
  icon: ClipboardList,
};

// Same rule for the AI page: provider, usage and caps are admin-only reads and writes.
const AI_ITEM: NavItem = {
  href: "/settings/ai",
  label: AI_STRINGS.nav,
  icon: Bot,
};

// Grouped left secondary menu (Pipedrive settings IA): My account for everyone, Company overview
// for managers and admins. Replaces the old flat tab bar.
export function SettingsNav({
  isAdmin,
  canManageCompany,
  canImport,
}: {
  isAdmin: boolean;
  canManageCompany: boolean;
  canImport: boolean;
}): React.ReactNode {
  const pathname = usePathname();
  const importItem: NavItem = {
    href: "/settings/import",
    label: STRINGS.settings.importData,
    icon: Upload,
  };
  const companyItems = [
    ...COMPANY.items,
    ...(isAdmin
      ? [
          AUTOMATIONS_ITEM,
          WEBHOOKS_ITEM,
          FORMS_ITEM,
          ENRICHMENT_ITEM,
          AI_ITEM,
          AUDIT_ITEM,
          BACKUPS_ITEM,
        ]
      : []),
    ...(canImport ? [importItem] : []),
  ];
  const sections = canManageCompany
    ? [MY_ACCOUNT, { title: COMPANY.title, items: companyItems }]
    : canImport
      ? [MY_ACCOUNT, { title: COMPANY.title, items: [importItem] }]
      : [MY_ACCOUNT];

  return (
    <nav aria-label="Settings sections" className="w-56 shrink-0 space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          {/* PD section header: 13px uppercase, muted, no extra letter-spacing. */}
          <p className="mb-1 px-2 text-[13px] font-semibold uppercase text-muted-foreground">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <SecondaryNavLink
                    href={item.href}
                    label={item.label}
                    icon={Icon}
                    active={active}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
