import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// text-title and text-meta are declared in globals.css, so tailwind-merge ships no rule for them
// and would read them as text colours: a later text-foreground then drops the size, with nothing
// reporting it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": ["text-title", "text-meta"] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
