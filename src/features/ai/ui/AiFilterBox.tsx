"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { describeFilterAction } from "@/features/ai/actions/filterActions";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import type { AiFilterEntity } from "@/features/ai/aiFilter";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";

interface Props {
  entity: AiFilterEntity;
  onDefinition: (definition: unknown) => void;
}

// 6.6 (U15): each entity gets its own example, so the suggestion on Leads does not talk about deals.
export const AI_FILTER_PLACEHOLDERS: Record<AiFilterEntity, string> = {
  deal: "Open deals over 10,000 closing this month",
  lead: "Leads from web forms with no activity",
  person: "People at North Systems added this year",
  organization: "Organizations in Media with open deals",
};

// Shared state for the two presentations: the inline box in the pipeline's Create filter modal and
// the Ask AI popover in the list toolbars. The action, the explanation and the error are identical.
export function useAiFilter(
  entity: AiFilterEntity,
  onDefinition: (definition: unknown) => void,
): {
  available: boolean;
  text: string;
  setText: (next: string) => void;
  explanation: string | null;
  errorId: string | null;
  pending: boolean;
  generate: () => Promise<void>;
} {
  const status = trpc.ai.status.useQuery();
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate(): Promise<void> {
    setPending(true);
    setErrorId(null);
    setExplanation(null);
    try {
      const result = await describeFilterAction({ entity, text }, readCsrfToken());
      if (!result.ok) {
        setErrorId(result.error.id);
        return;
      }
      setExplanation(result.value.explanation);
      onDefinition(result.value.definition);
    } finally {
      setPending(false);
    }
  }

  return {
    available: status.data === undefined || status.data.available !== false,
    text,
    setText,
    explanation,
    errorId,
    pending,
    generate,
  };
}

// The pipeline's Create filter modal keeps this box on purpose (spec 04 drives it): the box is part
// of the filter dialog, not a toolbar control.
export function AiFilterBox({ entity, onDefinition }: Props): React.ReactNode {
  const filter = useAiFilter(entity, onDefinition);
  if (!filter.available) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label htmlFor="ai-filter-text">Describe a filter</Label>
        <Input
          id="ai-filter-text"
          data-testid="ai-filter-input"
          value={filter.text}
          maxLength={500}
          placeholder={AI_FILTER_PLACEHOLDERS[entity]}
          onChange={(event) => filter.setText(event.target.value)}
          disabled={filter.pending}
        />
      </div>
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
    </div>
  );
}
