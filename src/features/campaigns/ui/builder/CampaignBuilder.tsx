"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Redo2, Undo2 } from "lucide-react";
import { useEffect, useId, useReducer, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { RichTextBody } from "@/features/email/composer/RichTextBody";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { uploadCampaignAssetAction } from "../../actions";
import type { CampaignBlock, CampaignDocument, LeafCampaignBlock } from "../../blocks/schema";
import { findBlock, type HistoryState, historyReducer, newBlockId } from "./history";
import { importHtmlBlock } from "./importHtml";
import { blockIdFromMessage } from "./messages";

// 6.6's Content step: a palette, a live 600 px preview with click-to-select, a properties panel,
// dnd-kit plus keyboard reorder, undo/redo and HTML import. The iframe is sandboxed with scripts
// only (no allow-same-origin), so its messages arrive with the opaque origin and nothing it does
// can touch this page.

const MERGE_FIELDS = [
  "person.first_name",
  "person.last_name",
  "person.name",
  "organization.name",
  "owner.name",
  "company.name",
];

const ADDABLE: Array<{ type: string; label: string }> = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "image", label: "Image" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "columns", label: "Two columns" },
  { type: "social", label: "Social links" },
  { type: "html", label: "HTML" },
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

function blockLabel(block: CampaignBlock): string {
  switch (block.type) {
    case "header":
      return "Header";
    case "heading":
      return `Heading: ${block.text.slice(0, 24)}`;
    case "text":
      return "Text";
    case "button":
      return `Button: ${block.label}`;
    case "image":
      return "Image";
    case "divider":
      return "Divider";
    case "spacer":
      return `Spacer ${block.height}px`;
    case "columns":
      return "Two columns";
    case "social":
      return "Social links";
    case "html":
      return "HTML block";
    default:
      return "Block";
  }
}

function blankBlock(type: string): CampaignBlock | null {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", text: "Your heading", level: 1, align: "left" };
    case "text":
      return { id, type: "text", html: "<p>Write something.</p>" };
    case "button":
      return { id, type: "button", label: "Read more", href: "https://example.com", align: "left" };
    case "image":
      return null;
    case "divider":
      return { id, type: "divider" };
    case "spacer":
      return { id, type: "spacer", height: 16 };
    case "columns":
      return {
        id,
        type: "columns",
        columns: [
          [{ id: newBlockId(), type: "text", html: "<p>Left column</p>" }],
          [{ id: newBlockId(), type: "text", html: "<p>Right column</p>" }],
        ],
      };
    case "social":
      return {
        id,
        type: "social",
        links: [{ network: "linkedin", url: "https://linkedin.com/company/example" }],
      };
    case "html":
      return { id, type: "html", html: "<p>Pasted HTML</p>" };
    default:
      return null;
  }
}

function SortableBlockRow({
  block,
  selected,
  onSelect,
}: {
  block: CampaignBlock;
  selected: boolean;
  onSelect: () => void;
}): React.ReactNode {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${selected ? "border-primary bg-accent" : "border-border"}`}
    >
      <button
        type="button"
        aria-label={`Reorder ${blockLabel(block)}`}
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" className="flex-1 truncate text-left" onClick={onSelect}>
        {blockLabel(block)}
      </button>
    </li>
  );
}

export interface CampaignBuilderProps {
  initialDocument: CampaignDocument;
  onChange?: (doc: CampaignDocument) => void;
}

export function CampaignBuilder({
  initialDocument,
  onChange,
}: CampaignBuilderProps): React.ReactNode {
  const [state, dispatch] = useReducer(historyReducer, {
    doc: initialDocument,
    past: [],
    future: [],
  } satisfies HistoryState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importHtml, setImportHtml] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [mergeField, setMergeField] = useState("");
  const [mergeSeq, setMergeSeq] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputId = useId();

  const preview = trpc.campaigns.preview.useQuery(
    { document: state.doc },
    { placeholderData: (previous) => previous },
  );
  const assets = trpc.campaigns.listAssets.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    onChange?.(state.doc);
  }, [state.doc, onChange]);

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      const id = blockIdFromMessage(event.origin, event.data);
      if (id !== null) setSelectedId(id);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (!event.altKey || selectedId === null) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        dispatch({ type: "move", id: selectedId, delta: -1 });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        dispatch({ type: "move", id: selectedId, delta: 1 });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const ids = state.doc.blocks.map((block) => block.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(state.doc.blocks, from, to);
    dispatch({ type: "set", doc: { ...state.doc, blocks: reordered } });
  }

  const selected = selectedId === null ? null : findBlock(state.doc, selectedId);

  function patch(patchValue: Record<string, unknown>): void {
    if (selectedId !== null) dispatch({ type: "patch", id: selectedId, patch: patchValue });
  }

  async function upload(file: File): Promise<void> {
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadCampaignAssetAction(formData, readCsrfToken());
    if (!result.ok) {
      setUploadError(result.error.id);
      return;
    }
    await utils.campaigns.listAssets.invalidate();
    patch({ assetId: result.value.id });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="space-y-4">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Undo"
            disabled={state.past.length === 0}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Redo"
            disabled={state.future.length === 0}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            Import HTML
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Add a block</h3>
          <div className="flex flex-wrap gap-1">
            {ADDABLE.map((entry) => (
              <Button
                key={entry.type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (entry.type === "image") {
                    setSelectedId(null);
                    setImportHtml("");
                    const first = assets.data?.[0];
                    if (first === undefined) {
                      setUploadError("Upload an image first, then add the block.");
                    } else {
                      dispatch({
                        type: "add",
                        block: {
                          id: newBlockId(),
                          type: "image",
                          assetId: first.id,
                          alt: "",
                          width: Math.min(600, first.width || 320),
                          align: "center",
                        },
                      });
                    }
                    return;
                  }
                  const block = blankBlock(entry.type);
                  if (block !== null) dispatch({ type: "add", block });
                }}
              >
                {entry.label}
              </Button>
            ))}
          </div>
          {uploadError === null ? null : <p className="text-xs text-destructive">{uploadError}</p>}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Blocks</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={state.doc.blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1">
                {state.doc.blocks.map((block) => (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    selected={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </aside>

      <section className="min-w-0">
        <iframe
          title="Campaign preview"
          sandbox="allow-scripts"
          srcDoc={preview.data?.html ?? ""}
          className="h-[660px] w-full rounded-lg border"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Click a block in the preview to edit it. Selected blocks can be moved with Alt+Up/Down.
        </p>
        {preview.data?.overLimit === true ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            This email is over 100 KB and cannot be sent.
          </p>
        ) : preview.data?.warning === true ? (
          <p className="mt-2 text-sm text-destructive">
            This email is over 90 KB; Gmail may clip it.
          </p>
        ) : null}
      </section>

      <aside className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Properties</h3>
        {selected === null ? (
          <p className="text-sm text-muted-foreground">Select a block to edit it.</p>
        ) : (
          <div className="space-y-3">
            {selected.type === "heading" ? (
              <>
                <FormField label="Text" htmlFor="block-heading-text">
                  <Input
                    id="block-heading-text"
                    value={selected.text}
                    onChange={(event) => patch({ text: event.target.value })}
                  />
                </FormField>
                <FormField label="Level" htmlFor="block-heading-level">
                  <Select
                    ariaLabel="Heading level"
                    value={String(selected.level)}
                    onChange={(value) => patch({ level: Number(value) })}
                    options={[
                      { value: "1", label: "Heading 1" },
                      { value: "2", label: "Heading 2" },
                    ]}
                  />
                </FormField>
              </>
            ) : null}

            {selected.type === "text" ? (
              <>
                <RichTextBody
                  html={selected.html}
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

            {selected.type === "button" ? (
              <>
                <FormField label="Label" htmlFor="block-button-label">
                  <Input
                    id="block-button-label"
                    value={selected.label}
                    onChange={(event) => patch({ label: event.target.value })}
                  />
                </FormField>
                <FormField label="URL" htmlFor="block-button-href">
                  <Input
                    id="block-button-href"
                    value={selected.href}
                    onChange={(event) => patch({ href: event.target.value })}
                  />
                </FormField>
              </>
            ) : null}

            {selected.type === "image" ? (
              <>
                <FormField label="Image" htmlFor="block-image-asset">
                  <Select
                    ariaLabel="Image"
                    value={selected.assetId}
                    onChange={(value) => patch({ assetId: value })}
                    options={(assets.data ?? []).map((asset) => ({
                      value: asset.id,
                      label: `${asset.width}×${asset.height}`,
                    }))}
                    placeholder="Choose an image"
                  />
                </FormField>
                <FormField label="Alt text" htmlFor="block-image-alt" required>
                  <Input
                    id="block-image-alt"
                    value={selected.alt}
                    onChange={(event) => patch({ alt: event.target.value })}
                  />
                </FormField>
                <FormField label="Width" htmlFor="block-image-width">
                  <Input
                    id="block-image-width"
                    type="number"
                    min={1}
                    max={600}
                    value={String(selected.width)}
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
                      if (file !== undefined) void upload(file);
                    }}
                  />
                </FormField>
                {uploadError === null ? null : (
                  <p className="text-sm text-destructive">Upload failed: {uploadError}</p>
                )}
              </>
            ) : null}

            {selected.type === "spacer" ? (
              <FormField label="Height" htmlFor="block-spacer-height">
                <Select
                  ariaLabel="Spacer height"
                  value={String(selected.height)}
                  onChange={(value) => patch({ height: Number(value) })}
                  options={SPACER_OPTIONS}
                />
              </FormField>
            ) : null}

            {selected.type === "html" ? (
              <FormField label="HTML" htmlFor="block-html">
                <Textarea
                  id="block-html"
                  rows={8}
                  value={selected.html}
                  onChange={(event) => patch({ html: event.target.value })}
                />
              </FormField>
            ) : null}

            {"align" in selected ? (
              <FormField label="Align" htmlFor="block-align">
                <Select
                  ariaLabel="Block alignment"
                  value={selected.align}
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
                onClick={() =>
                  dispatch({
                    type: "duplicate",
                    id: selected.id,
                    newId: newBlockId(),
                  })
                }
                disabled={selected.type === "columns"}
              >
                Duplicate
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  dispatch({ type: "remove", id: selected.id });
                  setSelectedId(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </aside>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Import HTML</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <FormField label="Paste email HTML" htmlFor="import-html" hint="Styles must be inline.">
              <Textarea
                id="import-html"
                rows={10}
                value={importHtml}
                onChange={(event) => setImportHtml(event.target.value)}
              />
            </FormField>
            {removed.length === 0 ? null : (
              <p className="text-sm text-muted-foreground">Removed: {removed.join(", ")}</p>
            )}
            {importError === null ? null : (
              <p className="text-sm text-destructive">{importError}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const result = importHtmlBlock(state.doc, importHtml, newBlockId());
                setRemoved(result.removed);
                if (result.doc === null) {
                  setImportError("Nothing importable was left after sanitising.");
                  return;
                }
                setImportError(null);
                dispatch({ type: "set", doc: result.doc });
                setImportHtml("");
                setImportOpen(false);
              }}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
