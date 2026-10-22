"use client";
import { LogOut } from "lucide-react";
import type React from "react";
import { wipeAndSignOut } from "./offline/wipe";

// The account menu's Log out link. It stays a real anchor (GET /auth/logout) so it works with
// JavaScript disabled, but wipes this device's offline records before navigating.
export function SignOutLink(): React.ReactNode {
  return (
    <a
      href="/auth/logout"
      onClick={(event) => {
        event.preventDefault();
        void wipeAndSignOut();
      }}
    >
      <LogOut aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      Log out
    </a>
  );
}
