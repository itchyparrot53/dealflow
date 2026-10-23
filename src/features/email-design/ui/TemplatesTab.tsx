"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { tableStyles } from "@/components/ui/table-styles";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import { trpc } from "@/lib/trpc-client";
import { EMAIL_TEMPLATES } from "../registry";
import type { TemplateListItem } from "../templates";
import { TemplateEditor } from "./TemplateEditor";

const S = EMAIL_DESIGN_STRINGS.templates;

function editedLabel(value: string | null): string {
  if (value === null) return S.default;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function TemplatesTab({ templates }: { templates: TemplateListItem[] }): React.ReactNode {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateListItem | null>(null);
  const [version, setVersion] = useState(0);
  const copy = trpc.emailDesign.template.useQuery(
    { key: editing?.key ?? "" },
    { enabled: editing !== null, refetchOnWindowFocus: false },
  );
  const def = editing === null ? null : EMAIL_TEMPLATES[editing.key];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{S.intro}</p>
      <div className="overflow-x-auto rounded-lg border bg-card [contain:paint]">
        <table className={tableStyles.table}>
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className={tableStyles.th}>{S.name}</th>
              <th className={tableStyles.th}>{S.audience}</th>
              <th className={tableStyles.th}>{S.lastEdited}</th>
              <th className={tableStyles.th}>
                <span className="sr-only">{S.edit}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {templates
              .filter((template) => template.editable)
              .map((template) => (
                <tr key={template.key} className="border-t hover:bg-accent/40">
                  <td className={tableStyles.td}>
                    <span className="font-medium">{template.name}</span>
                  </td>
                  <td className={tableStyles.td}>
                    <Badge variant="secondary">{template.audience}</Badge>
                  </td>
                  <td className={tableStyles.td}>{editedLabel(template.updatedAt)}</td>
                  <td className={`${tableStyles.td} text-right`}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(template)}
                    >
                      {S.edit}
                    </Button>
                  </td>
                </tr>
              ))}
            <tr className="border-t bg-muted/20">
              <td className={tableStyles.td}>
                <span className="font-medium">{S.yourEmails}</span>
                <p className="mt-0.5 text-meta text-muted-foreground">{S.yourEmailsHint}</p>
              </td>
              <td className={tableStyles.td}>
                <Badge variant="secondary">Customers</Badge>
              </td>
              <td className={tableStyles.td}>-</td>
              <td className={`${tableStyles.td} text-right`}>
                <Link
                  href="/settings/email"
                  className="text-sm font-medium text-link underline-offset-2 hover:underline"
                >
                  {S.openEmailSettings}
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {editing !== null && def != null && copy.data !== undefined && (
        <TemplateEditor
          key={`${editing.key}-${version}-${copy.data.subject}`}
          def={def}
          initial={copy.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setVersion((value) => value + 1);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
