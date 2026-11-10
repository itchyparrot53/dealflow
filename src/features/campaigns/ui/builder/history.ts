import type { CampaignBlock, CampaignDocument, LeafCampaignBlock } from "../../blocks/schema";

// The builder's document history (6.6). Pure, so undo/redo, reorder and nested-block edits are
// unit tested without React or the iframe.

export interface HistoryState {
  doc: CampaignDocument;
  past: CampaignDocument[];
  future: CampaignDocument[];
}

export type HistoryAction =
  | { type: "set"; doc: CampaignDocument }
  | { type: "add"; block: CampaignBlock }
  | { type: "patch"; id: string; patch: Record<string, unknown> }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; delta: -1 | 1 }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "undo" }
  | { type: "redo" };

export const HISTORY_LIMIT = 50;

function commit(state: HistoryState, doc: CampaignDocument): HistoryState {
  if (doc === state.doc) return state;
  return {
    doc,
    past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function newBlockId(): string {
  return globalThis.crypto.randomUUID();
}

function isColumns(block: CampaignBlock): block is Extract<CampaignBlock, { type: "columns" }> {
  return block.type === "columns";
}

export function findBlock(
  doc: CampaignDocument,
  id: string,
): CampaignBlock | LeafCampaignBlock | null {
  for (const block of doc.blocks) {
    if (block.id === id) return block;
    if (!isColumns(block)) continue;
    for (const column of block.columns) {
      for (const inner of column) if (inner.id === id) return inner;
    }
  }
  return null;
}

export function patchBlock(
  doc: CampaignDocument,
  id: string,
  patch: Record<string, unknown>,
): CampaignDocument {
  let changed = false;
  const blocks = doc.blocks.map((block) => {
    if (block.id === id) {
      changed = true;
      return { ...block, ...patch } as CampaignBlock;
    }
    if (!isColumns(block)) return block;
    let columnChanged = false;
    const columns = block.columns.map((column) =>
      column.map((inner) => {
        if (inner.id !== id) return inner;
        columnChanged = true;
        return { ...inner, ...patch } as LeafCampaignBlock;
      }),
    ) as Extract<CampaignBlock, { type: "columns" }>["columns"];
    if (!columnChanged) return block;
    changed = true;
    return { ...block, columns };
  });
  return changed ? { ...doc, blocks } : doc;
}

export function removeBlock(doc: CampaignDocument, id: string): CampaignDocument {
  const blocks = doc.blocks
    .filter((block) => block.id !== id)
    .map((block) =>
      isColumns(block)
        ? {
            ...block,
            columns: block.columns.map((column) =>
              column.filter((inner) => inner.id !== id),
            ) as Extract<CampaignBlock, { type: "columns" }>["columns"],
          }
        : block,
    );
  return { ...doc, blocks };
}

export function addBlock(doc: CampaignDocument, block: CampaignBlock): CampaignDocument {
  return { ...doc, blocks: [...doc.blocks, block] };
}

// Top-level reorder. Nested blocks follow their columns block, which is what the keyboard and the
// sortable list operate on.
export function moveBlock(doc: CampaignDocument, id: string, delta: -1 | 1): CampaignDocument {
  const index = doc.blocks.findIndex((block) => block.id === id);
  if (index < 0) return doc;
  const target = index + delta;
  if (target < 0 || target >= doc.blocks.length) return doc;
  const blocks = [...doc.blocks];
  const current = blocks[index];
  const other = blocks[target];
  if (current === undefined || other === undefined) return doc;
  blocks[index] = other;
  blocks[target] = current;
  return { ...doc, blocks };
}

export function duplicateBlock(doc: CampaignDocument, id: string, newId: string): CampaignDocument {
  const index = doc.blocks.findIndex((block) => block.id === id);
  if (index < 0) return doc;
  const source = doc.blocks[index];
  if (source === undefined || source.type === "columns") return doc;
  const copy: CampaignBlock = { ...source, id: newId } as CampaignBlock;
  const blocks = [...doc.blocks];
  blocks.splice(index + 1, 0, copy);
  return { ...doc, blocks };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "set":
      return commit(state, action.doc);
    case "add":
      return commit(state, addBlock(state.doc, action.block));
    case "patch":
      return commit(state, patchBlock(state.doc, action.id, action.patch));
    case "remove":
      return commit(state, removeBlock(state.doc, action.id));
    case "move":
      return commit(state, moveBlock(state.doc, action.id, action.delta));
    case "duplicate":
      return commit(state, duplicateBlock(state.doc, action.id, action.newId));
    case "undo": {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return { doc: previous, past: state.past.slice(0, -1), future: [state.doc, ...state.future] };
    }
    case "redo": {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}
