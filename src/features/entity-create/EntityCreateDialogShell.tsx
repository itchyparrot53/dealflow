"use client";

import type React from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EntityCreateDialogShellProps {
  title: string;
  children: React.ReactNode;
  bodyClassName?: string;
  error: string | null;
  pending: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

// The single create-dialog frame shared by deals, leads, people, and organizations. Entity
// variants own only their fields; sizing, scrolling, error treatment, actions, and dismissal
// behavior stay identical across every create surface.
export function EntityCreateDialogShell({
  title,
  children,
  bodyClassName,
  error,
  pending,
  submitDisabled = false,
  onSubmit,
  onClose,
}: EntityCreateDialogShellProps): React.ReactNode {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined} size="lg" className="bg-card">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className={bodyClassName}>
          {children}
          {error !== null && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={pending || submitDisabled} onClick={onSubmit}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
