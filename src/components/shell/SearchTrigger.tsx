"use client";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { STRINGS } from "@/constants/strings";
import { OPEN_SEARCH_EVENT } from "@/features/search/ui/events";

// The top bar's search pill (6.6): 240x40 rounded-full with a strong border, a 20 px icon, the
// "Search Dealflow" placeholder and a Cmd K hint. Below md it collapses to a 40 px round icon
// button so the title, add button, bell and avatar still fit at 375.
export function SearchTrigger(): React.ReactNode {
  return (
    <button
      type="button"
      aria-label="Open search"
      data-testid="search-pill"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))}
      className="flex size-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border-strong bg-card text-muted-foreground transition-colors duration-100 hover:border-placeholder md:h-10 md:w-60 md:justify-start md:px-3"
    >
      <Search aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-left text-sm md:block">
        {STRINGS.search.placeholder}
      </span>
      <Kbd className="hidden shrink-0 md:inline-flex">{"\u2318"}K</Kbd>
    </button>
  );
}
