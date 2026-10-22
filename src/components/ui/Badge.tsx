import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-1.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success/15 text-link-record",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "bg-transparent text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

// shadcn-style status/metadata primitive. Badges are static labels, so unlike Button they do not
// carry hover or press feedback.
export function Badge({ className, variant, ...props }: BadgeProps): React.ReactNode {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
