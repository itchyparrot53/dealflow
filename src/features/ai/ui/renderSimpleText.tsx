import { Fragment } from "react";

// Assistant text is rendered as React nodes, never HTML: paragraphs on blank lines, "- " lines as
// list items, and **bold** spans. Anything that looks like markup stays literal text.
function inline(line: string, keyPrefix: string): React.ReactNode[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${keyPrefix}-s-${part.slice(0, 16)}`}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={`${keyPrefix}-t-${part.slice(0, 16)}`}>{part}</Fragment>
      ),
    );
}

export function renderSimpleText(text: string): React.ReactNode {
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    // Keys are content-derived: the renderer has no stable ids, and index keys are banned.
    const blockKey = `b-${block.length}-${block.slice(0, 24)}`;
    if (lines.length > 0 && lines.every((line) => line.startsWith("- "))) {
      return (
        <ul key={blockKey} className="list-disc pl-4">
          {lines.map((line) => (
            <li key={`${blockKey}-i-${line.slice(2, 20)}-${line.length}`}>
              {inline(line.slice(2), `${blockKey}-${line.slice(2, 12)}`)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={blockKey}>
        {lines.map((line, lineIndex) => (
          <Fragment key={`${blockKey}-l-${line.slice(0, 20)}`}>
            {lineIndex > 0 && <br />}
            {inline(line, `${blockKey}-${line.slice(0, 12)}`)}
          </Fragment>
        ))}
      </p>
    );
  });
}
