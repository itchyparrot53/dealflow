"use client";
import type React from "react";
import { FormGrid } from "@/components/ui/form-field";
import { AddDealPersonColumn, type ContactPoint } from "@/features/deals/AddDealPersonColumn";
import { EntityCreateDialogShell } from "@/features/entity-create/EntityCreateDialogShell";

export interface EntityCreateModalShellProps {
  title: string;
  // The entity-specific fields (deal has pipeline/stage; lead does not) render in the left column.
  leftColumn: React.ReactNode;
  personMode: "existing" | "new";
  phones: ContactPoint[];
  emails: ContactPoint[];
  onPhones: (phones: ContactPoint[]) => void;
  onEmails: (emails: ContactPoint[]) => void;
  personCustomFields?: React.ReactNode;
  // "columns" keeps the Part 8 two-column frame; "stacked" is the Part 12 Add deal body: one
  // two-column FormGrid with the Person group as a full-span section under a divider (6.7.1).
  layout?: "columns" | "stacked";
  error: string | null;
  pending: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

// Deal/lead specialization of the shared create-dialog frame. Their entity-specific fields stay
// on the left and the reusable inline-person fields stay on the right.
export function EntityCreateModalShell(props: EntityCreateModalShellProps): React.ReactNode {
  const {
    title,
    layout = "columns",
    leftColumn,
    personMode,
    phones,
    emails,
    onPhones,
    onEmails,
    personCustomFields,
    error,
    pending,
    submitDisabled,
    onSubmit,
    onClose,
  } = props;

  return (
    <EntityCreateDialogShell
      title={title}
      bodyClassName={layout === "stacked" ? "space-y-6" : "grid gap-6 md:grid-cols-[1.4fr_1fr]"}
      error={error}
      pending={pending}
      submitDisabled={submitDisabled}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {layout === "stacked" ? (
        <>
          <FormGrid columns={2}>{leftColumn}</FormGrid>
          <div data-span="full" className="border-t pt-4">
            <AddDealPersonColumn
              disabled={personMode !== "new"}
              phones={phones}
              emails={emails}
              onPhones={onPhones}
              onEmails={onEmails}
            />
            {personMode === "new" ? personCustomFields : null}
          </div>
        </>
      ) : (
        <>
          {/* min-w-0 lets both fr tracks shrink to the dialog instead of overflowing it. */}
          <div className="min-w-0">{leftColumn}</div>
          <div className="min-w-0">
            <AddDealPersonColumn
              disabled={personMode !== "new"}
              phones={phones}
              emails={emails}
              onPhones={onPhones}
              onEmails={onEmails}
            />
            {personMode === "new" ? personCustomFields : null}
          </div>
        </>
      )}
    </EntityCreateDialogShell>
  );
}
