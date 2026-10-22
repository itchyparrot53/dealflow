import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// shadcn-style Input wrapper. The single-line counterpart to Textarea, and the sanctioned
// replacement for bare <input> across the create/edit forms. The box model (border, radius,
// padding, text size) matches the FIELD_INPUT class those forms already share, so migrating a
// site changes nothing at rest; the primitive only standardizes the parts that had drifted:
// the focus-visible ring, the placeholder color, and the disabled treatment. No background is
// set on purpose (FIELD_INPUT never set one, and --card == --background), so a migrated field
// keeps sitting transparently on whatever surface hosts it. Presentational text entry, so no
// Radix primitive applies; this is the standard wrapper to use instead of a bare <input>.
export const Input = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-md border border-border-strong bg-card px-2 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-100 ease-out placeholder:text-placeholder hover:border-placeholder focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
