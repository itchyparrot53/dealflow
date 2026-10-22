import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// shadcn (new-york) Textarea wrapper. Sanctioned multi-line text-entry control, matching the
// Input token scale (rounded-md = --radius). Presentational text entry, so no Radix primitive
// applies (unlike select/checkbox/radio); this is the standard wrapper to use instead of a
// bare <textarea>.
export const Textarea = forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-md border border-border-strong bg-card px-2 py-2 text-sm outline-none ring-offset-background transition-[border-color,box-shadow,background-color] duration-100 ease-out placeholder:text-placeholder hover:border-placeholder focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
