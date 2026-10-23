import type { ReactNode } from "react";

// Part 12, U13: the People / Organizations / Timeline panel moved into each page's toolbar as a
// ViewSwitcher, so contacts pages now use the full width. The layout keeps this file as the place
// for any future contacts-wide chrome, and deliberately adds no wrapper of its own.
export default function ContactsLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
