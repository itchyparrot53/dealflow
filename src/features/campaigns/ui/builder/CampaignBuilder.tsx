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
import { useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { uploadCampaignAssetAction } from "../../actions";
import type { CampaignBlock, CampaignDocument } from "../../blocks/schema";
import { BlockProperties } from "./BlockProperties";
import { findBlock, type HistoryState, historyReducer, newBlockId } from "./history";
import { ImportHtmlDialog } from "./ImportHtmlDialog";
import { blockIdFromMessage } from "./messages";

// 6.6's Content step: a palette, a live 600 px preview with click-to-select, a properties panel,
// dnd-kit plus keyboard reorder, undo/redo and HTML import. The iframe is sandboxed with scripts
// only (no allow-same-origin), so its messages arrive with the opaque origin and nothing it does
// can touch this page.

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
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        dispatch({ type: "move", id: selectedId, delta: event.key === "ArrowUp" ? -1 : 1 });
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
    dispatch({ type: "set", doc: { ...state.doc, blocks: arrayMove(state.doc.blocks, from, to) } });
  }

  function addBlock(type: string): void {
    setUploadError(null);
    if (type === "image") {
      const first = assets.data?.[0];
      if (first === undefined) {
        setUploadError("Upload an image first, then add the block.");
        return;
      }
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
      return;
    }
    const block = blankBlock(type);
    if (block !== null) dispatch({ type: "add", block });
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
    if (selectedId !== null)
      dispatch({ type: "patch", id: selectedId, patch: { assetId: result.value.id } });
  }

  const selected = selectedId === null ? null : findBlock(state.doc, selectedId);

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
                onClick={() => addBlock(entry.type)}
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
          <BlockProperties
            block={selected}
            assets={assets.data ?? []}
            uploadError={uploadError}
            patch={(patch) => {
              if (selectedId !== null) dispatch({ type: "patch", id: selectedId, patch });
            }}
            onDuplicate={() =>
              dispatch({ type: "duplicate", id: selected.id, newId: newBlockId() })
            }
            onDelete={() => {
              dispatch({ type: "remove", id: selected.id });
              setSelectedId(null);
            }}
            onUpload={(file) => void upload(file)}
          />
        )}
      </aside>

      <ImportHtmlDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        document={state.doc}
        onImported={(doc) => dispatch({ type: "set", doc })}
      />
    </div>
  );
}
