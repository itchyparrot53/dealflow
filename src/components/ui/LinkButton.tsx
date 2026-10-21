"use client";

import Link from "next/link";
import type React from "react";
import { buttonVariants } from "./Button";

// A link that looks like a Button. Server components may render it (it is a client component),
// whereas importing buttonVariants into a server component and calling it there is illegal because
// the module is client-only.
export function LinkButton({
  href,
  children,
  variant = "outline",
  size = "sm",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "icon";
}): React.ReactNode {
  return (
    <Link href={href} className={buttonVariants({ variant, size })}>
      {children}
    </Link>
  );
}
