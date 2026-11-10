"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { RichTextBody } from "@/features/email/composer/RichTextBody";
import type { CampaignBlock, LeafCampaignBlock } from "../../blocks/schema";

// The right-hand panel of the builder (6.6). One component per selected block type, all editing the
// document through `patch`; kept out of CampaignBuilder so neither file outgrows its lint budget.

const MERGE_FIELDS = [
  "person.first_name",
  "person.last_name",
  "person.name",
  "organization.name",
  "owner.name",
  "company.name",
];

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const SPACER_OPTIONS = [8, 16, 24, 32, 48].map((height) => ({
  value: String(height),
  label: `${height} px`,
}));

export interface BlockPropertiesProps {
  block: CampaignBlock | LeafCampaignBlock;
  assets: Array<{ id: string; width: number; height: number }>;
  uploadError: string | null;
  patch: (patch: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
}

export function BlockProperties({
  block,
  assets,
  uploadError,
  patch,
  onDuplicate,
  onDelete,
  onUpload,
}: BlockPropertiesProps): React.ReactNode {
  const fileInputId = useId();
  const [mergeField, setMergeField] = useState("");
  const [mergeSeq, setMergeSeq] = useState(0);

  return (
    <div className="space-y-3">
      {block.type === "heading" ? (
        <>
          <FormField label="Text" htmlFor="block-heading-text">
            <Input
              id="block-heading-text"
              value={block.text}
              onChange={(event) => patch({ text: event.target.value })}
            />
          </FormField>
          <FormField label="Level" htmlFor="block-heading-level">
            <Select
              ariaLabel="Heading level"
              value={String(block.level)}
              onChange={(value) => patch({ level: Number(value) })}
              options={[
                { value: "1", label: "Heading 1" },
                { value: "2", label: "Heading 2" },
              ]}
            />
          </FormField>
        </>
      ) : null}

      {block.type === "text" ? (
        <>
          <RichTextBody
            html={block.html}
            onChange={(html) => patch({ html })}
            ariaLabel="Text block"
            insertToken={
              mergeField === "" ? undefined : { text: `{{${mergeField}}}`, seq: mergeSeq }
            }
          />
          <FormField label="Insert merge field" htmlFor="block-merge">
            <Select
              ariaLabel="Insert merge field"
              value=""
              onChange={(value) => {
                if (value === "") return;
                setMergeField(value);
                setMergeSeq((seq) => seq + 1);
              }}
              options={MERGE_FIELDS.map((field) => ({ value: field, label: `{{${field}}}` }))}
              placeholder="Insert merge field"
            />
          </FormField>
        </>
      ) : null}

      {block.type === "button" ? (
        <>
          <FormField label="Label" htmlFor="block-button-label">
            <Input
              id="block-button-label"
              value={block.label}
              onChange={(event) => patch({ label: event.target.value })}
            />
          </FormField>
          <FormField label="URL" htmlFor="block-button-href">
            <Input
              id="block-button-href"
              value={block.href}
              onChange={(event) => patch({ href: event.target.value })}
            />
          </FormField>
        </>
      ) : null}

      {block.type === "image" ? (
        <>
          <FormField label="Image" htmlFor="block-image-asset">
            <Select
              ariaLabel="Image"
              value={block.assetId}
              onChange={(value) => patch({ assetId: value })}
              options={assets.map((asset) => ({
                value: asset.id,
                label: `${asset.width}×${asset.height}`,
              }))}
              placeholder="Choose an image"
            />
          </FormField>
          <FormField label="Alt text" htmlFor="block-image-alt" required>
            <Input
              id="block-image-alt"
              value={block.alt}
              onChange={(event) => patch({ alt: event.target.value })}
            />
          </FormField>
          <FormField label="Width" htmlFor="block-image-width">
            <Input
              id="block-image-width"
              type="number"
              min={1}
              max={600}
              value={String(block.width)}
              onChange={(event) => patch({ width: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="Upload an image" htmlFor={fileInputId}>
            <input
              id={fileInputId}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) onUpload(file);
              }}
            />
          </FormField>
          {uploadError === null ? null : (
            <p className="text-sm text-destructive">Upload failed: {uploadError}</p>
          )}
        </>
      ) : null}

      {block.type === "spacer" ? (
        <FormField label="Height" htmlFor="block-spacer-height">
          <Select
            ariaLabel="Spacer height"
            value={String(block.height)}
            onChange={(value) => patch({ height: Number(value) })}
            options={SPACER_OPTIONS}
          />
        </FormField>
      ) : null}

      {block.type === "html" ? (
        <FormField label="HTML" htmlFor="block-html">
          <Textarea
            id="block-html"
            rows={8}
            value={block.html}
            onChange={(event) => patch({ html: event.target.value })}
          />
        </FormField>
      ) : null}

      {"align" in block ? (
        <FormField label="Align" htmlFor="block-align">
          <Select
            ariaLabel="Block alignment"
            value={block.align}
            onChange={(value) => patch({ align: value })}
            options={ALIGN_OPTIONS}
          />
        </FormField>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDuplicate}
          disabled={block.type === "columns"}
        >
          Duplicate
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
