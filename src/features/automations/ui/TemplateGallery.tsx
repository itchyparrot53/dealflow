"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { createAutomationFromTemplateAction } from "../actions";

const S = AUTOMATIONS_STRINGS;

export interface TemplateCard {
  key: string;
  name: string;
  description: string;
}

export function TemplateGallery({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateCard[];
}): React.ReactNode {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function pick(key: string): Promise<void> {
    setBusyKey(key);
    const result = await createAutomationFromTemplateAction(key);
    setBusyKey(null);
    if (!result.ok) return;
    onOpenChange(false);
    router.push(`/settings/automations/${result.value.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="automation-templates-dialog">
        <DialogHeader>
          <DialogTitle>{S.templates}</DialogTitle>
          <DialogDescription>{S.intro}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              className="rounded-md border p-3 text-left transition-colors hover:bg-accent"
              data-testid="automation-template-card"
              disabled={busyKey !== null}
              onClick={() => void pick(template.key)}
            >
              <span className="block text-sm font-medium">{template.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {template.description}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {S.actions.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
