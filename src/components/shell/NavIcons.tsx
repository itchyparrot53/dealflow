import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  FileText,
  FolderKanban,
  Inbox,
  Kanban,
  Lightbulb,
  List,
  Megaphone,
  Settings,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";
import type { NavKey } from "@/constants/nav";

// Named wrappers over lucide so the nav's glyph vocabulary lives in one place.
// aria-hidden keeps each link's accessible name its label text.

type IconProps = { className?: string };

const NAV_ICON_CLASS = "h-[18px] w-[18px] shrink-0";

export function DocsIcon({ className }: IconProps): React.ReactNode {
  return <BookOpen aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function PipelineIcon({ className }: IconProps): React.ReactNode {
  return <Kanban aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function ForecastIcon({ className }: IconProps): React.ReactNode {
  return <TrendingUp aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function DealsIcon({ className }: IconProps): React.ReactNode {
  return <List aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

// Sprout, not a funnel: the board's Filter control is lucide's funnel, and two
// identical glyphs in one viewport would read as the same thing.
export function LeadsIcon({ className }: IconProps): React.ReactNode {
  return <Sprout aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function ProjectsIcon({ className }: IconProps): React.ReactNode {
  return <FolderKanban aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function InsightsIcon({ className }: IconProps): React.ReactNode {
  return <Lightbulb className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function DocumentsIcon({ className }: IconProps): React.ReactNode {
  return <FileText aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function ContactsIcon({ className }: IconProps): React.ReactNode {
  return <Users aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function ActivitiesIcon({ className }: IconProps): React.ReactNode {
  return <CalendarDays aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function CampaignsIcon({ className }: IconProps): React.ReactNode {
  return <Megaphone aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function InboxIcon({ className }: IconProps): React.ReactNode {
  return <Inbox aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function DashboardIcon({ className }: IconProps): React.ReactNode {
  return <ChartColumn aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

export function SettingsIcon({ className }: IconProps): React.ReactNode {
  return <Settings aria-hidden="true" className={className ?? NAV_ICON_CLASS} />;
}

// One map for every nav surface (rail, bottom bar, More sheet), so a new item cannot render a
// different glyph in one place than another.
export const NAV_ICONS: Record<NavKey, (props: IconProps) => React.ReactNode> = {
  pipeline: PipelineIcon,
  forecast: ForecastIcon,
  documents: DocumentsIcon,
  insights: InsightsIcon,
  projects: ProjectsIcon,
  leads: LeadsIcon,
  contacts: ContactsIcon,
  activities: ActivitiesIcon,
  inbox: InboxIcon,
  campaigns: CampaignsIcon,
  dashboard: DashboardIcon,
  settings: SettingsIcon,
};
