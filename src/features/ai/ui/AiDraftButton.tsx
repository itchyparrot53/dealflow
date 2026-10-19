"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { draftEmailAction } from "@/features/ai/actions/composeActions";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import type { EmailTone } from "@/features/ai/emailDraft";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "short", label: "Short" },
] as const;

interface Props {
  dealId: string | null;
  personId: string | null;
  recipientEmail: string | undefined;
  onDraft: (draft: { subject: string; bodyHtml: string }) => void;
}

// "Write with AI" popover in the email composer. It only drafts: the result fills the subject and
// body, and the user still presses Send themselves.
export function AiDraftButton({
  dealId,
  personId,
  recipientEmail,
  onDraft,
}: Props): React.ReactNode {
  const status = trpc.ai.status.useQuery();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState<EmailTone>("friendly");
  const [pending, setPending] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);

  if (status.data !== undefined && status.data.available === false) return null;

  async function draft(): Promise<void> {
    setPending(true);
    setErrorId(null);
    try {
      const result = await draftEmailAction(
        {
          instruction,
          tone,
          ...(dealId === null ? {} : { dealId }),
          ...(personId === null ? {} : { personId }),
          ...(recipientEmail === undefined ? {} : { recipientEmail }),
        },
        readCsrfToken(),
      );
      if (!result.ok) {
        setErrorId(result.error.id);
        return;
      }
      onDraft({ subject: result.value.subject, bodyHtml: result.value.bodyHtml });
      setInstruction("");
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" data-testid="ai-draft-trigger">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Write with AI
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label htmlFor="ai-draft-instruction">What should the email say?</Label>
          <Textarea
            id="ai-draft-instruction"
            rows={3}
            maxLength={500}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-draft-tone">Tone</Label>
          <Select
            value={tone}
            onChange={(value) => setTone(value as EmailTone)}
            options={[...TONE_OPTIONS]}
            ariaLabel="Tone"
            disabled={pending}
          />
        </div>
        {errorId !== null && (
          <p data-testid="ai-draft-error" className="text-sm text-destructive">
            {aiErrorMessage(errorId)}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void draft()}
            disabled={pending || instruction.trim() === ""}
          >
            {pending ? "Drafting..." : "Draft"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
