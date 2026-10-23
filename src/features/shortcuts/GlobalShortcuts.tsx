"use client";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { RAIL_TOGGLE_EVENT } from "@/components/shell/railState";
import { NAV_ITEMS } from "@/constants/nav";
import { type CreateKind, useCreateDialog } from "@/features/create/CreateDialogProvider";
import { navHrefForKey } from "./navShortcut";
import { SEQUENCE_MAP, SEQUENCE_TIMEOUT_MS } from "./registry";
import { ShortcutHelp } from "./ShortcutHelp";
import { createSequenceMatcher } from "./sequences";
import { isOverlayOpen, isTypingTarget } from "./shortcutTarget";

// App-wide keyboard shortcuts that belong to no single component (Pipedrive parity): the number row
// jumps to a primary nav item, g/n sequences navigate or open a create surface, and ? opens the
// shortcut sheet. Mounted once in the app layout.
export function GlobalShortcuts(): React.ReactNode {
  const router = useRouter();
  const { openCreate } = useCreateDialog();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);

  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  useEffect(() => {
    const matcher = createSequenceMatcher(SEQUENCE_MAP, SEQUENCE_TIMEOUT_MS);

    const onKeyDown = (e: KeyboardEvent): void => {
      const typing = isTypingTarget(e.target);
      const overlay = isOverlayOpen(document);
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // The sheet itself is an overlay; ignore while it is open so Escape owns closing it.
        if (typing || overlay) return;
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        matcher.reset();
        return;
      }
      if (typing || overlay) {
        matcher.reset();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        window.dispatchEvent(new Event(RAIL_TOGGLE_EVENT));
        return;
      }
      const href = navHrefForKey(e.key, NAV_ITEMS);
      if (href !== null) {
        e.preventDefault();
        router.push(href);
        return;
      }
      const command = matcher.press(e.key, Date.now());
      if (command !== null) {
        e.preventDefault();
        if (command.startsWith("create:")) {
          openCreate(command.slice("create:".length) as CreateKind);
        } else {
          router.push(command.slice("navigate:".length));
        }
      }
    };

    const openHelp = (): void => {
      if (!helpOpenRef.current) setHelpOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("warpdrive:open-shortcuts", openHelp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("warpdrive:open-shortcuts", openHelp);
    };
  }, [router, openCreate]);

  return <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
