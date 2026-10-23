"use client";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/form-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Textarea } from "@/components/ui/Textarea";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import type { AiFilterEntity } from "@/features/ai/aiFilter";
import { AI_FILTER_PLACEHOLDERS, useAiFilter } from "./AiFilterBox";

// 6.6 (U15): the plain-English filter builder is a toolbar button, not a tall card wedged into the
// toolbar. The 360 px popover keeps the same field, action and tests as the inline box.
export function AiFilterButton({
  entity,
  onDefinition,
}: {
  entity: AiFilterEntity;
  onDefinition: (definition: unknown) => void;
}): React.ReactNode {
  const filter = useAiFilter(entity, onDefinition);
  const [open, setOpen] = useState(false);
  if (!filter.available) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="ai-filter-trigger">
          <Sparkles aria-hidden="true" className="size-3.5" />
          Ask AI
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] space-y-3" align="end">
        <FormField label="Describe a filter" htmlFor="ai-filter-text">
          <Textarea
            id="ai-filter-text"
            data-testid="ai-filter-input"
            rows={3}
            maxLength={500}
            placeholder={AI_FILTER_PLACEHOLDERS[entity]}
            value={filter.text}
            onChange={(event) => filter.setText(event.target.value)}
            disabled={filter.pending}
          />
        </FormField>
        {filter.explanation !== null && (
          <p data-testid="ai-filter-explanation" className="text-sm text-muted-foreground">
            {filter.explanation}
          </p>
        )}
        {filter.errorId !== null && (
          <div className="flex items-start justify-between gap-2">
            <p data-testid="ai-filter-error" className="text-sm text-destructive">
              {aiErrorMessage(filter.errorId)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="ai-filter-retry"
              onClick={() => void filter.generate()}
              disabled={filter.pending || filter.text.trim() === ""}
            >
              Try again
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void filter.generate()}
            disabled={filter.pending || filter.text.trim() === ""}
          >
            {filter.pending ? "Generating..." : "Generate filter"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
