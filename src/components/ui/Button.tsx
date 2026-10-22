"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Pipedrive's control scale: sm 28, md 32, lg 40; padding 0 12; 14/600; radius 4. Every variant
// swaps to the neutral disabled pair rather than fading, so a disabled label keeps its contrast.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold transition-[color,background-color,border-color,opacity,scale] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled-foreground motion-reduce:transition-[color,background-color,border-color,opacity]",
  {
    variants: {
      variant: {
        default: "bg-action text-action-foreground hover:bg-primary-hover active:brightness-95",
        secondary: "border border-border-strong bg-card text-foreground hover:bg-muted",
        outline: "border border-border-strong bg-card text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        // Irreversible actions (delete, discard). Used by ConfirmDialog's affirmative button.
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:brightness-95",
        // Won / positive confirmation.
        success: "bg-success text-success-foreground hover:bg-primary-hover active:brightness-95",
        link: "text-info underline-offset-2 hover:underline",
        // A 32x32 secondary icon button (toolbar, dialog close).
        icon: "text-muted-foreground hover:bg-muted hover:text-foreground",
        // The top bar's 40x40 round add button.
        round: "rounded-full border border-border-strong bg-card text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-7 px-3",
        md: "h-8 px-3",
        lg: "h-10 px-3",
        icon: "size-8",
        round: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  // Disables the tactile scale-on-press feedback when the motion would be distracting
  // (e.g. large full-width or toolbar buttons that fire on every interaction).
  static?: boolean;
  // Shows a 14 px spinner before the label and blocks repeat clicks.
  loading?: boolean;
}

// Subtle press feedback; 0.96 is the smallest value that still reads as tactile rather than
// exaggerated. not-disabled so a disabled button doesn't appear to react to clicks.
const TAP_SCALE =
  "motion-safe:active:not-disabled:scale-[0.96] motion-reduce:active:not-disabled:opacity-80";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, type, static: isStatic, loading, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled === true || loading === true}
      className={cn(buttonVariants({ variant, size }), isStatic !== true && TAP_SCALE, className)}
      {...props}
    >
      {loading === true ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// The toolbar's primary split button: the action at left, a 32x32 caret segment at right with a
// 1 px white divider, joined into one rounded-md group.
export function SplitButton({
  label,
  icon,
  onMain,
  menuLabel = "More actions",
  testId,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onMain: () => void;
  menuLabel?: string;
  testId?: string;
}): React.ReactNode {
  return (
    <div className="inline-flex">
      <button
        type="button"
        onClick={onMain}
        data-testid={testId}
        className={cn(buttonVariants({ variant: "default" }), "rounded-r-none")}
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        onClick={onMain}
        aria-label={menuLabel}
        data-testid={testId === undefined ? undefined : `${testId}-menu`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-r-md border-l border-white/25 bg-action text-action-foreground transition-colors duration-100 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
