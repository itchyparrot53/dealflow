"use client";
import { useSyncExternalStore } from "react";
import { MOBILE_BREAKPOINT_PX } from "@/constants/pwa";

// The single source of the mobile breakpoint for JS-rendered layout switches. CSS uses the same
// 768px (Tailwind's md) through MOBILE_BREAKPOINT_PX; a missing matchMedia (SSR, jsdom) reads as
// desktop so the table markup is what tests and the server render.
const QUERY = `(max-width: ${String(MOBILE_BREAKPOINT_PX - 1)}px)`;

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

const getServerSnapshot = (): boolean => false;

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
