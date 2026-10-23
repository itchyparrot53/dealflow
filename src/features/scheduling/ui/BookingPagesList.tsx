"use client";

import { CalendarClock, MoreHorizontal } from "lucide-react";
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
import { BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  createBookingPageAction,
  deleteBookingPageAction,
  setBookingPageActiveAction,
} from "../actions";

const S = BOOKING_STRINGS;

export interface BookingPageRowView {
  id: string;
  publicId: string;
  title: string;
  hostName: string;
  durationMinutes: number;
  active: boolean;
}

export function BookingPagesList({
  rows,
  showHost,
  baseUrl,
}: {
  rows: BookingPageRowView[];
  showHost: boolean;
  baseUrl: string;
}): React.ReactNode {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<BookingPageRowView | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPage(): Promise<void> {
    setCreating(true);
    setError(null);
    const result = await createBookingPageAction({ title: "New booking page" }, readCsrfToken());
    setCreating(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.push(`/settings/booking/${result.value.id}`);
  }

  async function toggle(row: BookingPageRowView, active: boolean): Promise<void> {
    await setBookingPageActiveAction(row.id, active, readCsrfToken());
    router.refresh();
  }

  async function copyLink(row: BookingPageRowView): Promise<void> {
    await navigator.clipboard.writeText(`${baseUrl}/book/${row.publicId}`);
  }

  async function remove(row: BookingPageRowView): Promise<void> {
    await deleteBookingPageAction(row.id, readCsrfToken());
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="booking-page-new"
          disabled={creating}
          onClick={() => void createPage()}
        >
          {S.newPage}
        </Button>
        {error === null ? null : <span className="text-sm text-destructive">{error}</span>}
      </div>

      <table className="w-full text-sm" data-testid="booking-pages-table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">{S.table.title}</th>
            {showHost ? <th className="py-2 font-medium">{S.table.host}</th> : null}
            <th className="py-2 font-medium">{S.table.duration}</th>
            <th className="py-2 font-medium">{S.table.link}</th>
            <th className="py-2 font-medium">{S.table.active}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showHost ? 6 : 5}>
                <EmptyState
                  title={S.emptyTitle}
                  body={S.emptyBody}
                  icon={<CalendarClock aria-hidden="true" />}
                  action={
                    <Button size="sm" disabled={creating} onClick={() => void createPage()}>
                      {S.newPage}
                    </Button>
                  }
                  className="py-10"
                />
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b"
              data-testid="booking-page-row"
              data-page-id={row.id}
            >
              <td className="py-2">
                <Link className="hover:underline" href={`/settings/booking/${row.id}`}>
                  {row.title}
                </Link>
              </td>
              {showHost ? <td className="py-2">{row.hostName}</td> : null}
              <td className="py-2">
                {row.durationMinutes} {S.editor.minutes}
              </td>
              <td className="py-2">
                <a
                  className="text-link hover:underline"
                  href={`${baseUrl}/book/${row.publicId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {S.table.link}
                </a>
              </td>
              <td className="py-2">
                <Switch
                  checked={row.active}
                  onCheckedChange={(active) => void toggle(row, active)}
                  label={S.table.active}
                  testId="booking-page-active"
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
                      <Link href={`/settings/booking/${row.id}`}>{S.rowMenu.edit}</Link>
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
