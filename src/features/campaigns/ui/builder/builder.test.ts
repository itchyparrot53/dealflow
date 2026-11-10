import { describe, expect, it } from "vitest";
import type { CampaignDocument } from "../../blocks/schema";
import {
  findBlock,
  type HistoryState,
  historyReducer,
  moveBlock,
  newBlockId,
  patchBlock,
} from "./history";
import { importHtmlBlock } from "./importHtml";
import { blockIdFromMessage } from "./messages";

const DOC: CampaignDocument = {
  version: 1,
  settings: {
    backgroundColor: "#F4F4F2",
    contentWidth: 600,
    fontFamily: "system",
    linkColor: "#2D8548",
  },
  blocks: [
    { id: "h", type: "heading", text: "Title", level: 1, align: "left" },
    { id: "t", type: "text", html: "<p>Body</p>" },
    {
      id: "cols",
      type: "columns",
      columns: [[{ id: "n1", type: "text", html: "<p>Left</p>" }], []],
    },
  ],
};

function state(doc: CampaignDocument = DOC): HistoryState {
  return { doc, past: [], future: [] };
}

describe("history reducer", () => {
  it("adds a block and can undo it", () => {
    const added = historyReducer(state(), {
      type: "add",
      block: { id: "new", type: "divider" },
    });
    expect(added.doc.blocks).toHaveLength(4);
    const undone = historyReducer(added, { type: "undo" });
    expect(undone.doc.blocks).toHaveLength(3);
    const redone = historyReducer(undone, { type: "redo" });
    expect(redone.doc.blocks).toHaveLength(4);
  });

  it("patches a nested block and leaves the rest alone", () => {
    const patched = patchBlock(DOC, "n1", { html: "<p>Changed</p>" });
    const block = findBlock(patched, "n1");
    expect(block?.type).toBe("text");
    if (block?.type === "text") expect(block.html).toBe("<p>Changed</p>");
    expect(findBlock(patched, "h")).toEqual({
      id: "h",
      type: "heading",
      text: "Title",
      level: 1,
      align: "left",
    });
  });

  it("removes a nested block from its column", () => {
    const removed = historyReducer(state(), { type: "remove", id: "n1" });
    expect(findBlock(removed.doc, "n1")).toBeNull();
    expect(removed.doc.blocks).toHaveLength(3);
  });

  it("moves a top-level block and stops at the edges", () => {
    const moved = moveBlock(DOC, "t", -1);
    expect(moved.blocks.map((b) => b.id)).toEqual(["t", "h", "cols"]);
    expect(moveBlock(DOC, "h", -1).blocks.map((b) => b.id)).toEqual(["h", "t", "cols"]);
    expect(moveBlock(DOC, "cols", 1).blocks.map((b) => b.id)).toEqual(["h", "t", "cols"]);
  });

  it("duplicates a top-level block right after the original", () => {
    const copied = historyReducer(state(), { type: "duplicate", id: "h", newId: "h2" });
    expect(copied.doc.blocks.map((b) => b.id)).toEqual(["h", "h2", "t", "cols"]);
  });

  it("bounds the undo stack at HISTORY_LIMIT", () => {
    let current = state();
    for (let i = 0; i < 60; i += 1) {
      current = historyReducer(current, {
        type: "patch",
        id: "h",
        patch: { text: `Title ${i}` },
      });
    }
    expect(current.past.length).toBeLessThanOrEqual(50);
  });

  it("creates unique ids through the platform UUID", () => {
    expect(newBlockId()).not.toBe(newBlockId());
  });
});

describe("iframe selection messages", () => {
  it("ignores a foreign origin", () => {
    expect(
      blockIdFromMessage("https://evil.example", { type: "df-block-click", id: "h" }),
    ).toBeNull();
  });

  it("accepts the sandboxed opaque origin with a valid payload", () => {
    expect(blockIdFromMessage("null", { type: "df-block-click", id: "h" })).toBe("h");
  });

  it("rejects a malformed payload", () => {
    expect(blockIdFromMessage("null", { type: "other", id: "h" })).toBeNull();
    expect(blockIdFromMessage("null", { type: "df-block-click", id: "" })).toBeNull();
    expect(blockIdFromMessage("null", null)).toBeNull();
    expect(blockIdFromMessage("null", "<div>")).toBeNull();
  });
});

describe("import HTML", () => {
  it("appends a sanitised html block and reports the stripped tags", () => {
    const result = importHtmlBlock(DOC, "<div>Hi<script>alert(1)</script></div>", "imported");
    expect(result.doc?.blocks).toHaveLength(4);
    const block = result.doc === null ? null : findBlock(result.doc, "imported");
    expect(block?.type).toBe("html");
    if (block?.type === "html") expect(block.html).not.toContain("<script");
    expect(result.removed).toContain("script");
  });

  it("returns no document for empty or fully stripped markup", () => {
    expect(importHtmlBlock(DOC, "   ", "x").doc).toBeNull();
    expect(importHtmlBlock(DOC, "<script>alert(1)</script>", "x").doc).toBeNull();
  });
});
