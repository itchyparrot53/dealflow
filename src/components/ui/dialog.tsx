"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type React from "react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useRef,
} from "react";
import { capture, currentRoute } from "@/features/observability/capture";
import { EVENTS } from "@/features/observability/events";
import { cn } from "@/lib/utils";

// shadcn (new-york) Dialog wrapper over @radix-ui/react-dialog. This is the SANCTIONED
// replacement for hand-rolled `fixed inset-0` modal overlays: it brings focus trap, scroll
// lock, Escape-to-close, and portal for free. See CLAUDE.md "Use the design system, never
// reinvent". A lint rule bans new hand-rolled `fixed inset-0` overlays; this file is exempt
// because it IS the sanctioned overlay implementation.
//
// Part 12 anatomy (PLAN-PART12.md 6.2): the content is a flex column with no padding, the header
// owns the close button and never scrolls away, and DialogBody is the only scroll container.
// Records why the last dialog dismissal was requested, for the modal_closed `reason`. Reset to
// "programmatic" whenever a dialog opens, so a suppressed dismissal (e.g. an outside-press that did
// not actually close the dialog) cannot mislabel a later close. Single dialog at a time is the norm
// in this app, so a module-level slot is sufficient.
let lastCloseReason: "user" | "escape" | "outside" | "programmatic" = "programmatic";

function setLastCloseReason(reason: "user" | "escape" | "outside"): void {
  lastCloseReason = reason;
}

function emitModalOpened(): void {
  lastCloseReason = "programmatic";
  capture(EVENTS.modalOpened, { route: currentRoute() });
}

function emitModalClosed(): void {
  capture(EVENTS.modalClosed, { route: currentRoute(), reason: lastCloseReason });
}

export function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>): React.ReactNode {
  const { open, defaultOpen } = props;
  const isControlled = open !== undefined;
  // Seeded from the initial open state; tracks the last emitted state so we emit on real transitions.
  const prevOpen = useRef<boolean>(open ?? defaultOpen ?? false);

  // Emit once if the dialog mounts already open (a route-mounted modal, or defaultOpen).
  useEffect(() => {
    if (prevOpen.current) emitModalOpened();
  }, []);

  // For CONTROLLED dialogs the parent `open` prop is the lifecycle source of truth: Radix's
  // onOpenChange fires only for internal interactions, not when a parent flips `open`, so
  // state-driven opens and closes (the "modal closing when it should not" case this feature exists
  // to surface) are observed here rather than in the callback.
  useEffect(() => {
    if (open === undefined || open === prevOpen.current) return;
    prevOpen.current = open;
    if (open) emitModalOpened();
    else emitModalClosed();
  }, [open]);

  const handleOpenChange = (next: boolean): void => {
    if (!isControlled) {
      // Uncontrolled dialogs have no `open` prop to observe, so this callback is their lifecycle
      // source.
      prevOpen.current = next;
      if (next) emitModalOpened();
      else emitModalClosed();
    } else if (!next && prevOpen.current) {
      // Controlled dialogs are normally observed by the [open] effect. But a controlled dialog that
      // is conditionally UNMOUNTED on close (GlobalNoteModal, the convert/merge dialogs) never
      // re-renders with open=false, so the effect never sees the transition. Emit the close here,
      // before the parent callback runs and may unmount us, and mark prevOpen so the [open] effect
      // dedups when the dialog instead stays mounted (avoiding a double modal_closed).
      prevOpen.current = false;
      emitModalClosed();
    }
    props.onOpenChange?.(next);
  };
  return <DialogPrimitive.Root {...props} onOpenChange={handleOpenChange} />;
}
export const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-150 motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

type CloseButton = "header" | "corner" | "none";

// Tells DialogHeader whether it owns the close button (6.2). Default "header" means a dialog
// without a DialogHeader must ask for "corner" or "none"; check-design's dialog-anatomy enforces it.
const DialogCloseContext = createContext<CloseButton>("header");

function DialogCloseButton({ className }: { className?: string }): React.ReactNode {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      data-testid="dialog-close"
      onClick={() => setLastCloseReason("user")}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
        className,
      )}
    >
      <X className="size-4" strokeWidth={2.25} />
    </DialogPrimitive.Close>
  );
}

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg";
    // 6.2: "header" (the header renders it), "corner" (no header), "none" (must not dismiss).
    closeButton?: CloseButton;
  }
>(({ className, children, size = "md", closeButton = "header", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-size={size}
      onEscapeKeyDown={() => setLastCloseReason("escape")}
      onPointerDownOutside={() => setLastCloseReason("outside")}
      onInteractOutside={() => setLastCloseReason("outside")}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-48px)] w-full flex-col gap-0 overflow-hidden rounded-lg border bg-popover p-0 shadow-dialog translate-x-[-50%] translate-y-[-50%] data-[size=sm]:max-w-[480px] data-[size=md]:max-w-[600px] data-[size=lg]:max-w-[800px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=closed]:slide-out-to-top-[48%] motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      <DialogCloseContext.Provider value={closeButton}>
        {children}
        {closeButton === "corner" ? <DialogCloseButton className="absolute right-3 top-3" /> : null}
      </DialogCloseContext.Provider>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  const closeButton = useContext(DialogCloseContext);
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
      {closeButton === "header" ? <DialogCloseButton className="-mr-2" /> : null}
    </div>
  );
}

// The only scroll container in the dialog (6.2): the header and footer never scroll away.
export function DialogBody({
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

// Footer, with 6.2's optional start slot: a child carrying data-slot="start" is pushed left.
export function DialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4", className)}
      {...props}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const slot = (child.props as { "data-slot"?: string })["data-slot"];
        if (slot !== "start") return child;
        const childClassName = (child.props as { className?: string }).className;
        return cloneElement(child as React.ReactElement<{ className?: string }>, {
          className: cn("mr-auto", childClassName),
        });
      })}
    </div>
  );
}

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, children, title, ...props }, ref) => {
  // The header truncates the title instead of wrapping it (6.2), so keep the full text available
  // through the native tooltip when the visible line is clipped.
  const titleAttr = title ?? (typeof children === "string" ? children : undefined);
  return (
    <DialogPrimitive.Title
      ref={ref}
      title={titleAttr}
      className={cn("truncate text-base font-semibold", className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  );
});
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
