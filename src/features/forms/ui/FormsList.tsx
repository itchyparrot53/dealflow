"use client";

import { ClipboardList, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Switch } from "@/components/ui/Switch";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createFormAction, deleteFormAction, setFormActiveAction } from "../actions";

const S = FORMS_STRINGS;

export interface FormRowView {
  id: string;
  publicId: string;
  name: string;
  creates: "lead" | "deal";
  ownerName: string;
  submissionCount: number;
  active: boolean;
}

export function FormsList({
  rows,
  currentUserId,
  baseUrl,
}: {
  rows: FormRowView[];
  currentUserId: string;
  baseUrl: string;
}): React.ReactNode {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<FormRowView | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createForm(): Promise<void> {
    setCreating(true);
    setError(null);
    const result = await createFormAction(
      {
        name: "New form",
        title: "Contact us",
        // A contact form is what "New form" is for, so the draft starts with the four fields a
        // visitor expects; more can be added in the editor.
        fields: [
          { key: "name", label: S.fieldLabels.name, required: true, placeholder: null },
          { key: "email", label: S.fieldLabels.email, required: true, placeholder: null },
          {
            key: "organization",
            label: S.fieldLabels.organization,
            required: false,
            placeholder: null,
          },
          { key: "message", label: S.fieldLabels.message, required: false, placeholder: null },
        ],
        creates: "lead",
        ownerId: currentUserId,
        successMessage: "Thanks, we will be in touch.",
      },
      readCsrfToken(),
    );
    setCreating(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.push(`/settings/forms/${result.value.id}`);
  }

  async function toggle(row: FormRowView, active: boolean): Promise<void> {
    await setFormActiveAction(row.id, active, readCsrfToken());
    router.refresh();
  }

  async function copyLink(row: FormRowView): Promise<void> {
    await navigator.clipboard.writeText(`${baseUrl}/f/${row.publicId}`);
  }

  async function remove(row: FormRowView): Promise<void> {
    await deleteFormAction(row.id, readCsrfToken());
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="form-new"
          disabled={creating}
          onClick={() => void createForm()}
        >
          {S.newForm}
        </Button>
        {error === null ? null : <span className="text-sm text-destructive">{error}</span>}
      </div>

      <table className="w-full text-sm" data-testid="forms-table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">{S.table.name}</th>
            <th className="py-2 font-medium">{S.table.creates}</th>
            <th className="py-2 font-medium">{S.table.owner}</th>
            <th className="py-2 font-medium">{S.table.submissions}</th>
            <th className="py-2 font-medium">{S.table.active}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title={S.emptyTitle}
                  body={S.emptyBody}
                  icon={<ClipboardList aria-hidden="true" />}
                  action={
                    <Button size="sm" disabled={creating} onClick={() => void createForm()}>
                      {S.newForm}
                    </Button>
                  }
                  className="py-10"
                />
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-b" data-testid="form-row" data-form-id={row.id}>
              <td className="py-2">
                <Link className="hover:underline" href={`/settings/forms/${row.id}`}>
                  {row.name}
                </Link>
              </td>
              <td className="py-2">{S.creates[row.creates]}</td>
              <td className="py-2">{row.ownerName}</td>
              <td className="py-2">{row.submissionCount}</td>
              <td className="py-2">
                <Switch
                  checked={row.active}
                  onCheckedChange={(active) => void toggle(row, active)}
                  label={S.table.active}
                  testId="form-active"
                />
              </td>
              <td className="py-2 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={S.rowMenu.edit}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/settings/forms/${row.id}`}>{S.rowMenu.edit}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void copyLink(row)}>
                      {S.rowMenu.copyLink}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setPendingDelete(row)}>
                      {S.rowMenu.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? null : setPendingDelete(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{S.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{S.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete !== null) void remove(pendingDelete);
              }}
            >
              {S.rowMenu.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
