"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";

const S = FORMS_STRINGS.embed;

export function EmbedCode({
  publicId,
  title,
  baseUrl,
}: {
  publicId: string;
  title: string;
  baseUrl: string;
}): React.ReactNode {
  const [copied, setCopied] = useState<string | null>(null);
  const link = `${baseUrl}/f/${publicId}`;
  const iframe = `<iframe src="${link}" width="100%" height="640" style="border:0" title="${title.replace(/"/g, "&quot;")}"></iframe>`;

  async function copy(value: string, which: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(which);
  }

  return (
    <section className="space-y-2" data-testid="form-embed-code">
      <h2 className="text-sm font-medium">{S.title}</h2>
      <div className="flex items-center gap-2">
        <Input readOnly value={link} aria-label={S.link} data-testid="form-public-link" />
        <Button type="button" variant="outline" onClick={() => void copy(link, "link")}>
          {copied === "link" ? S.copied : S.copy}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input readOnly value={iframe} aria-label={S.iframe} />
        <Button type="button" variant="outline" onClick={() => void copy(iframe, "iframe")}>
          {copied === "iframe" ? S.copied : S.copy}
        </Button>
      </div>
    </section>
  );
}
