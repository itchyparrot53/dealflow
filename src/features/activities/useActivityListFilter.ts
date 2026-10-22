"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type PresetRange, presetRange } from "./activityDatePresets";
import type { ActivityListFilter } from "./schemas";
import { useLocalNow } from "./useLocalNow";

// URL-backed activity filters (6.6). The list keeps them in the query string, so a reload, a shared
// link and the CSV export all see the same filter instead of a fresh in-memory default.

const UNRESOLVED_RANGE: PresetRange = { from: null, to: null };
const FILTER_KEYS = ["ownerId", "done", "from", "to", "typeKey", "search"] as const;
const DONE_VALUES = ["all", "open", "done"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ActivityListFilterState {
  filter: ActivityListFilter;
  setFilter: Dispatch<SetStateAction<ActivityListFilter | null>>;
  ready: boolean;
}

function defaultFilter(currentUserId: string, range: PresetRange): ActivityListFilter {
  return {
    ownerId: currentUserId,
    done: "open",
    from: range.from,
    to: range.to,
    typeKey: null,
    search: null,
  };
}

function parseFilter(
  params: URLSearchParams,
  currentUserId: string,
  range: PresetRange,
): ActivityListFilter {
  const base = defaultFilter(currentUserId, range);
  const owner = params.get("ownerId");
  const done = params.get("done");
  const from = params.get("from");
  const to = params.get("to");
  const typeKey = params.get("typeKey");
  const search = params.get("search");
  return {
    // "ownerId=" (empty) means every owner; an absent key keeps the signed-in default.
    ownerId: params.has("ownerId") ? (owner === "" ? null : owner) : base.ownerId,
    done: DONE_VALUES.includes(done as (typeof DONE_VALUES)[number])
      ? (done as ActivityListFilter["done"])
      : base.done,
    // "none" is the explicit cleared range (a null from/to would otherwise re-derive today).
    from: from === "none" ? null : from !== null && DATE.test(from) ? from : base.from,
    to: to === "none" ? null : to !== null && DATE.test(to) ? to : base.to,
    typeKey,
    search: search !== null && search.trim() !== "" ? search.trim().slice(0, 100) : null,
  };
}

function hasFilterParams(params: URLSearchParams): boolean {
  return FILTER_KEYS.some((key) => params.has(key));
}

function serialize(filter: ActivityListFilter): string {
  const params = new URLSearchParams();
  params.set("ownerId", filter.ownerId ?? "");
  params.set("done", filter.done);
  // Always write both range keys: an omitted key would fall back to today's default on reload.
  params.set("from", filter.from ?? "none");
  params.set("to", filter.to ?? "none");
  if (filter.typeKey !== null) params.set("typeKey", filter.typeKey);
  if (filter.search !== null && filter.search !== "") params.set("search", filter.search);
  return params.toString();
}

export function useActivityListFilter(currentUserId: string): ActivityListFilterState {
  const localNow = useLocalNow();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ready = localNow !== null;
  const range = localNow === null ? UNRESOLVED_RANGE : presetRange("today", localNow);
  const rangeFrom = range.from;
  const rangeTo = range.to;

  // In-memory copy for immediate re-renders (and so the toolbar's tests keep their state-driven
  // behaviour); the URL mirrors it for reloads, shared links and the export. The URL is re-read
  // only until the first user change, so a navigation that only changes the back-stack does not
  // fight the visible filter.
  const [chosen, setChosen] = useState<ActivityListFilter | null>(null);
  const fromUrl = useMemo(
    () =>
      parseFilter(new URLSearchParams(searchParams.toString()), currentUserId, {
        from: rangeFrom,
        to: rangeTo,
      }),
    [searchParams, currentUserId, rangeFrom, rangeTo],
  );
  const filter = chosen ?? fromUrl;

  // Normalise a bare URL to the visible defaults once, so the export link (which reads the query
  // string) carries the same filter the table shows instead of exporting everything.
  useEffect(() => {
    // `chosen !== null` means the user already set a filter; the default write must not race it.
    if (!ready || chosen !== null || hasFilterParams(searchParams)) return;
    const next = defaultFilter(currentUserId, { from: rangeFrom, to: rangeTo });
    router.replace(`${pathname}?${serialize(next)}`, { scroll: false });
  }, [ready, chosen, searchParams, pathname, router, currentUserId, rangeFrom, rangeTo]);

  const setFilter = useCallback<Dispatch<SetStateAction<ActivityListFilter | null>>>(
    (updater) => {
      const next = typeof updater === "function" ? updater(filter) : updater;
      const resolved = next ?? defaultFilter(currentUserId, { from: rangeFrom, to: rangeTo });
      setChosen(resolved);
      router.replace(`${pathname}?${serialize(resolved)}`, { scroll: false });
    },
    [filter, currentUserId, rangeFrom, rangeTo, router, pathname],
  );

  return { filter, setFilter, ready };
}
