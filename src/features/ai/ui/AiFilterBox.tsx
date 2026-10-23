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

// Plain-English filter builder: it only fills the dialog's conditions, the user still applies or
// saves the filter through the normal controls.
export function AiFilterBox({ entity, onDefinition }: Props): React.ReactNode {
  const status = trpc.ai.status.useQuery();
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status.data !== undefined && status.data.available === false) return null;

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

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label htmlFor="ai-filter-text">Describe a filter</Label>
        <Input
          id="ai-filter-text"
          data-testid="ai-filter-input"
          value={text}
          maxLength={500}
          placeholder="Open deals over 10,000 closing this month"
          onChange={(event) => setText(event.target.value)}
          disabled={pending}
        />
      </div>
      {explanation !== null && (
        <p data-testid="ai-filter-explanation" className="text-sm text-muted-foreground">
          {explanation}
        </p>
      )}
      {errorId !== null && (
        <div className="flex items-start justify-between gap-2">
          <p data-testid="ai-filter-error" className="text-sm text-destructive">
            {aiErrorMessage(errorId)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="ai-filter-retry"
            onClick={() => void generate()}
            disabled={pending || text.trim() === ""}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void generate()}
          disabled={pending || text.trim() === ""}
        >
          {pending ? "Generating..." : "Generate filter"}
        </Button>
      </div>
    </div>
  );
}
