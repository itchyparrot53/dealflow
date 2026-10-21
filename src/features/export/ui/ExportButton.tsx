"use client";

import { useSearchParams } from "next/navigation";
import type React from "react";
import { buttonVariants } from "@/components/ui/Button";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";

const S = PROJECTS_API_STRINGS.export;

// A plain download link (no fetch): the browser handles the attachment and the server sets the
// file name. The current list filters travel in the query string; the visible columns ride along
// in `columns` so the file matches the table.
export function ExportButton({
  entity,
  columns,
}: {
  entity: string;
  columns: string[];
}): React.ReactNode {
  const params = useSearchParams();
  const query = new URLSearchParams(params.toString());
  query.set("columns", columns.join(","));
  return (
    <a
      data-testid="export-csv"
      href={`/export/${entity}?${query.toString()}`}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {S.button}
    </a>
  );
}
