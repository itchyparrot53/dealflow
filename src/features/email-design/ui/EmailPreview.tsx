"use client";

import type React from "react";
import { useState } from "react";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import { cn } from "@/lib/utils";

const S = EMAIL_DESIGN_STRINGS.branding;

// The exact HTML the server renders, in a scriptless iframe. The width toggle matches the two
// widths the gallery captures (600 and 375).
export function EmailPreview({
  html,
  title = S.preview,
  className,
}: {
  html: string;
  title?: string;
  className?: string;
}): React.ReactNode {
  const [width, setWidth] = useState<600 | 375>(600);
  return (
    <div className={cn("space-y-2", className)}>
      <fieldset className="inline-flex rounded-md border bg-card p-0.5" aria-label={S.previewWidth}>
        <legend className="sr-only">{S.previewWidth}</legend>
        {(
          [
            [600, S.desktop],
            [375, S.mobile],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={width === value}
            onClick={() => setWidth(value)}
            className={cn(
              "h-7 rounded px-2.5 text-meta font-medium transition-colors duration-100",
              width === value
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div className="overflow-auto rounded-lg border bg-canvas-subtle p-3">
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          width={width}
          className="mx-auto block h-[620px] rounded-md border bg-white"
          style={{ maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
