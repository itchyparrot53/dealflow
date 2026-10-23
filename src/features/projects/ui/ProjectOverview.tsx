"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
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
import { projectsErrorMessage } from "@/constants/projectsApiStrings";
import { useToastStore } from "@/features/feedback/toastStore";
import { readCsrfToken } from "@/utils/csrfCookie";
import { updateProjectAction } from "../actions";

// The project brief: stored and searched since Part 8 but until now invisible, which left project
// pages as a bare board. Read-only viewers get the text without an edit affordance.
export function ProjectOverview({
  projectId,
  description,
  canEdit,
}: {
  projectId: string;
  description: string | null;
  canEdit: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(description ?? "");
  const [pending, setPending] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function save(): Promise<void> {
    setPending(true);
    const trimmed = draft.trim();
    const response = await updateProjectAction(
      projectId,
      { description: trimmed === "" ? null : trimmed },
      readCsrfToken(),
    );
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setOpen(false);
    useToastStore.getState().push({ message: "Project description saved." });
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      {description === null || description === "" ? (
        <p className="text-sm text-muted-foreground">No description yet.</p>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mt-1 text-muted-foreground"
          onClick={() => {
            setDraft(description ?? "");
            setErrorId(null);
            setOpen(true);
          }}
        >
          <Pencil aria-hidden="true" className="mr-1 size-3.5" />
          Edit description
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Edit description</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Description" hint="A short brief for the project team.">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                maxLength={5000}
                autoFocus
              />
            </FormField>
            {errorId !== null && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {projectsErrorMessage(errorId)}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={pending} onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
