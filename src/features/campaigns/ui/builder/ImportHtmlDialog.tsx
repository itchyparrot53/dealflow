"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/Textarea";
import type { CampaignDocument } from "../../blocks/schema";
import { newBlockId } from "./history";
import { importHtmlBlock } from "./importHtml";

// "Import HTML" (6.6): sanitise once, append the block and show what was removed, so the author
// knows their markup changed instead of discovering it in the sent email.

export function ImportHtmlDialog({
  open,
  onOpenChange,
  document,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: CampaignDocument;
  onImported: (doc: CampaignDocument) => void;
}): React.ReactNode {
  const [html, setHtml] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setHtml("");
    setRemoved([]);
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import HTML</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <FormField label="Paste email HTML" htmlFor="import-html" hint="Styles must be inline.">
            <Textarea
              id="import-html"
              rows={10}
              value={html}
              onChange={(event) => setHtml(event.target.value)}
            />
          </FormField>
          {removed.length === 0 ? null : (
            <p className="text-sm text-muted-foreground">Removed: {removed.join(", ")}</p>
          )}
          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const result = importHtmlBlock(document, html, newBlockId());
              setRemoved(result.removed);
              if (result.doc === null) {
                setError("Nothing importable was left after sanitising.");
                return;
              }
              onImported(result.doc);
              reset();
              onOpenChange(false);
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
