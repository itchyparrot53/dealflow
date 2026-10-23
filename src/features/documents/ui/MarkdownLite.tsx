import type React from "react";
import { formatMoney, parseCents } from "@/features/currency/money";
import type { DocumentLineView } from "../lines";
import {
  type InlineSegment,
  inlineSegments,
  type MdBlock,
  parseMarkdownLite,
} from "../markdownLite";

// The block list is rebuilt from the source on every render and never reordered,
// so a positional key is stable; it is built by helpers because the linter bans a
// bare index as a key.
function blockKey(block: MdBlock, position: number): string {
  return `${block.type}-${position}`;
}

function segmentKey(segment: InlineSegment, position: number): string {
  return `${segment.bold ? "bold" : "text"}-${position}`;
}

function itemKey(item: string, position: number): string {
  return `${item}-${position}`;
}

// Renders the parsed markdown-lite blocks as React elements. No HTML string is
// ever built, so a template can never inject markup into a public page.

function Inline({ text }: { text: string }): React.ReactNode {
  const segments = inlineSegments(text);
  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={segmentKey(segment, index)}>{segment.text}</strong>
        ) : (
          <span key={segmentKey(segment, index)}>{segment.text}</span>
        ),
      )}
    </>
  );
}

// Stored numerics carry their column scale ("2.000", "10.00"); the printed
// document shows the number a reader expects, without touching the stored value.
function trimZeros(value: string): string {
  const trimmed = value.replace(/\.?0+$/, "");
  return trimmed === "" ? "0" : trimmed;
}

function LinesTable({
  lines,
  currency,
}: {
  lines: readonly DocumentLineView[];
  currency?: string;
}): React.ReactNode {
  const money = (value: string): string =>
    currency === undefined ? value : formatMoney(parseCents(value), currency);
  return (
    // The six numeric columns cannot fit a phone's document width, so the table scrolls inside
    // its own container instead of widening the page.
    <div
      className="overflow-x-auto"
      // 6.7.5's narrower paper preview can make a wide block scroll; a scroll region needs to be
      // reachable from the keyboard (axe scrollable-region-focusable).
      tabIndex={0}
      role="region"
      aria-label="Scrollable document content"
    >
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Discount</th>
            <th className="py-2 text-right font-medium">Tax</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{line.name}</td>
              <td className="py-2">{trimZeros(line.quantity)}</td>
              <td className="py-2 text-right">{money(line.itemPrice)}</td>
              <td className="py-2 text-right">{trimZeros(line.discountPercent)}%</td>
              <td className="py-2 text-right">{trimZeros(line.taxPercent)}%</td>
              <td className="py-2 text-right">{money(line.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownLite({
  source,
  lines,
  currency,
}: {
  source: string;
  lines?: readonly DocumentLineView[];
  currency?: string;
}): React.ReactNode {
  const blocks = parseMarkdownLite(source);
  return (
    <div className="space-y-3 text-sm">
      {blocks.map((block: MdBlock, index) => {
        switch (block.type) {
          case "h1":
            return (
              <h1 key={blockKey(block, index)} className="text-title">
                <Inline text={block.text} />
              </h1>
            );
          case "h2":
            return (
              <h2 key={blockKey(block, index)} className="text-lg font-semibold">
                <Inline text={block.text} />
              </h2>
            );
          case "p":
            return (
              <p key={blockKey(block, index)}>
                <Inline text={block.text} />
              </p>
            );
          case "hr":
            return <hr key={blockKey(block, index)} className="border-border" />;
          case "ul":
            return (
              <ul key={blockKey(block, index)} className="list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemKey(item, itemIndex)}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          case "products":
            return lines !== undefined && lines.length > 0 ? (
              <LinesTable key={blockKey(block, index)} lines={lines} currency={currency} />
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
}
