"use client";

import Link from "next/link";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { trpc } from "@/lib/trpc-client";

const S = FORMS_STRINGS.editor;

interface SubmissionRow {
  id: string;
  values: Record<string, unknown>;
  personId: string | null;
  leadId: string | null;
  dealId: string | null;
  createdAt: string | Date;
  personName: string | null;
  leadTitle: string | null;
  dealTitle: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function SubmissionsTable({ formId }: { formId: string }): React.ReactNode {
  const submissions = trpc.forms.submissions.useQuery({ formId });
  const rows = (submissions.data ?? []) as SubmissionRow[];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{S.submissionsEmpty}</p>;
  }

  return (
    <table className="w-full text-sm" data-testid="form-submissions">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 font-medium">When</th>
          <th className="py-2 font-medium">Name</th>
          <th className="py-2 font-medium">Email</th>
          <th className="py-2 font-medium">Record</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b">
            <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
            <td className="py-2">{text(row.values.name)}</td>
            <td className="py-2">{text(row.values.email)}</td>
            <td className="py-2">
              {row.leadId === null ? null : (
                <Link className="hover:underline" href={`/leads/${row.leadId}`}>
                  {row.leadTitle ?? "Lead"}
                </Link>
              )}
              {row.dealId === null ? null : (
                <Link className="hover:underline" href={`/deals/${row.dealId}`}>
                  {row.dealTitle ?? "Deal"}
                </Link>
              )}
              {row.leadId === null && row.dealId === null && row.personId !== null ? (
                <Link className="hover:underline" href={`/contacts/people/${row.personId}`}>
                  {row.personName ?? "Person"}
                </Link>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
