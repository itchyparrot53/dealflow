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
    <table className="w-full border-collapse text-sm">
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
            <td className="py-2">{line.quantity}</td>
            <td className="py-2 text-right">{money(line.itemPrice)}</td>
            <td className="py-2 text-right">{line.discountPercent}%</td>
            <td className="py-2 text-right">{line.taxPercent}%</td>
            <td className="py-2 text-right">{money(line.gross)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
              <h1
                key={blockKey(block, index)}
                className="text-display font-semibold leading-tight tracking-tight"
              >
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
