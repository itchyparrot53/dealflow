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
  params,
}: {
  entity: string;
  columns: string[];
  // Filters the table holds outside the URL (the pipeline is in the path, for example).
  params?: Record<string, string>;
}): React.ReactNode {
  const search = useSearchParams();
  const query = new URLSearchParams(search.toString());
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== "") query.set(key, value);
  }
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
