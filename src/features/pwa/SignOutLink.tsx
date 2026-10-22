"use client";
import { LogOut } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { wipeAndSignOut } from "./offline/wipe";

// The account menu's Log out link. It stays a real anchor (GET /auth/logout) so it works with
// JavaScript disabled, but wipes this device's offline records before navigating. forwardRef and
// the prop spread are required so the Radix DropdownMenuItem wrapper (asChild) can supply the
// menuitem role, focus handling and its own click handler.
export const SignOutLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<"a">>(
  function SignOutLink(props, ref): ReactNode {
    const { onClick, ...rest } = props;
    return (
      <a
        {...rest}
        ref={ref}
        href="/auth/logout"
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
          void wipeAndSignOut();
        }}
      >
        <LogOut aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        Log out
      </a>
    );
  },
);
