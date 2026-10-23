"use client";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// shadcn (new-york) Sheet: a side-anchored drawer over @radix-ui/react-dialog. This is the
// SANCTIONED right-anchored overlay (Pipedrive opens person/org/lead detail as a slide-over over
// the list). Like Dialog it brings focus trap, scroll lock, Escape-to-close, and portal for free;
// the lint ban on hand-rolled `fixed inset-0` overlays exempts src/components/ui/**.
//
// Part 12 (PLAN-PART12.md 6.2): SheetHeader carries the close button inside the header rule and
// SheetBody is the scroll container, the same anatomy as Dialog. Existing custom sheets (the
// mobile reply sheet, the assistant panel) keep their own header and the corner close, so the
// default closeButton is "corner"; a header-mode sheet passes closeButton="header".
export const Sheet = SheetPrimitive.Root;
const SheetPortal = SheetPrimitive.Portal;
export const SheetClose = SheetPrimitive.Close;

const SheetOverlay = forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150 motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

type CloseButton = "header" | "corner" | "none";

// Right-anchored, full-height content column. Width is capped so the list stays partly visible
// behind the scrim (Pipedrive's overlay leaves the list context in view).
export const SheetContent = forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    closeButton?: CloseButton;
  }
>(({ className, children, closeButton = "corner", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[480px] flex-col rounded-l-lg border-l bg-popover shadow-dialog outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:animate-none",
        // Legacy custom sheets scroll the whole column; a header-mode sheet scrolls its body.
        closeButton === "corner" ? "overflow-y-auto" : "overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
      {closeButton === "corner" ? (
        <SheetPrimitive.Close
          aria-label="Close"
          data-testid="dialog-close"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" strokeWidth={2.25} />
        </SheetPrimitive.Close>
      ) : null}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

// The header rule owns the close button (6.2): a flex row, never scrolled away by SheetBody.
export function SheetHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex min-h-14 shrink-0 items-center justify-between gap-4 border-b px-6 py-3",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4", className)}
      {...props}
    />
  );
}

export const SheetTitle = forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, children, title, ...props }, ref) => {
  const titleAttr = title ?? (typeof children === "string" ? children : undefined);
  return (
    <SheetPrimitive.Title
      ref={ref}
      title={titleAttr}
      className={cn("truncate text-base font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </SheetPrimitive.Title>
  );
});
SheetTitle.displayName = "SheetTitle";
