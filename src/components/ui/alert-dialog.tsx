"use client";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
} from "react";
import { cn } from "@/lib/utils";

// shadcn (new-york) AlertDialog wrapper over @radix-ui/react-alert-dialog. The SANCTIONED primitive
// for a destructive confirmation: unlike Dialog it uses role="alertdialog", does not dismiss on
// outside-click, and focuses the Cancel action, so a stray click cannot confirm. Escape still
// dismisses (verified in-browser), which is safe: it lands on Cancel, never on the action.
// See CLAUDE.md "Use the design system, never reinvent".
//
// Part 12 (PLAN-PART12.md 6.2): the same header, body and footer anatomy as Dialog, and the close
// button defaults to "none" because a confirmation must be answered through its actions.
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-150 motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

type CloseButton = "header" | "corner" | "none";
const AlertDialogCloseContext = createContext<CloseButton>("none");

function AlertDialogCloseButton({ className }: { className?: string }): React.ReactNode {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <button
        type="button"
        aria-label="Close"
        data-testid="dialog-close"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <X className="size-4" strokeWidth={2.25} />
      </button>
    </AlertDialogPrimitive.Cancel>
  );
}

export const AlertDialogContent = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
    closeButton?: CloseButton;
  }
>(({ className, children, closeButton = "none", ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-48px)] w-full max-w-[480px] translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-lg border bg-popover p-0 shadow-dialog data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=closed]:slide-out-to-top-[48%] motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      <AlertDialogCloseContext.Provider value={closeButton}>
        {children}
        {closeButton === "corner" ? (
          <AlertDialogCloseButton className="absolute right-3 top-3" />
        ) : null}
      </AlertDialogCloseContext.Provider>
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export function AlertDialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  const closeButton = useContext(AlertDialogCloseContext);
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex min-h-14 shrink-0 items-center justify-between gap-4 border-b px-6 py-3 text-left",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {closeButton === "header" ? <AlertDialogCloseButton className="-mr-2" /> : null}
    </div>
  );
}

export function AlertDialogBody({
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

export function AlertDialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse items-stretch gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
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

export const AlertDialogTitle = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, children, title, ...props }, ref) => {
  const titleAttr = title ?? (typeof children === "string" ? children : undefined);
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      title={titleAttr}
      className={cn("truncate text-base font-semibold", className)}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Title>
  );
});
AlertDialogTitle.displayName = "AlertDialogTitle";

export const AlertDialogDescription = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
