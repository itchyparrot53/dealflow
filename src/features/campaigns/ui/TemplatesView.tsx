"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { deleteCampaignTemplateAction, duplicateCampaignTemplateAction } from "../actions";
import type { CampaignDocument } from "../blocks/schema";
import { CAMPAIGN_STARTERS } from "../blocks/starters";

// 2.4's Templates view. "Use" is delegated to the page because creating a campaign belongs to the
// campaign editor (Task 3.1); this component never invents a campaign row itself.

export interface TemplatesViewProps {
  onUse: (document: CampaignDocument, name: string) => void;
}

export function TemplatesView({ onUse }: TemplatesViewProps): React.ReactNode {
  const utils = trpc.useUtils();
  const templates = trpc.campaigns.templates.useQuery();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string): Promise<void> {
    setError(null);
    const result = await deleteCampaignTemplateAction({ id }, readCsrfToken());
    setDeleting(null);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    await utils.campaigns.templates.invalidate();
  }

  async function duplicate(id: string): Promise<void> {
    setError(null);
    const result = await duplicateCampaignTemplateAction({ id }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    await utils.campaigns.templates.invalidate();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Start with a template</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPAIGN_STARTERS.map((starter) => (
            <div key={starter.key} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium">{starter.name}</h3>
              <p className="flex-1 text-xs text-muted-foreground">{starter.description}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid={`starter-use-${starter.key}`}
                onClick={() => onUse(starter.document, starter.name)}
              >
                Use
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Saved templates</h2>
        {(templates.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved templates yet. Save one from the campaign builder.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {(templates.data ?? []).map((template) => (
              <li key={template.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="flex-1 text-sm font-medium">{template.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(template.updatedAt).toLocaleDateString()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUse(template.content as CampaignDocument, template.name)}
                >
                  Use
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void duplicate(template.id)}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleting(template.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
      </section>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              Campaigns made from it keep their content. This only removes the template.
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting !== null && void remove(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
