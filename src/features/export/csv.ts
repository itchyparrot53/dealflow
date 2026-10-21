// RFC 4180 CSV for every list export (and Part 7's report CSV, which delegates here). A cell that
// a spreadsheet could execute as a formula gets a leading apostrophe; the guard applies before the
// quoting decision, so the apostrophe is inside the quotes when the cell needs them.

export type CsvCell = string | number | null;

const FORMULA_LEADERS: readonly string[] = ["=", "+", "-", "@", "\t", "\r"];
const NEEDS_QUOTING = /[",\r\n]/;

function cell(value: CsvCell): string {
  if (value === null) return "";
  const raw = String(value);
  const guarded = FORMULA_LEADERS.some((leader) => raw.startsWith(leader)) ? `'${raw}` : raw;
  return NEEDS_QUOTING.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

// One record, CRLF-terminated, as RFC 4180 asks.
export function csvLine(cells: CsvCell[]): string {
  return `${cells.map(cell).join(",")}\r\n`;
}

// A streamed CSV body. The BOM makes Excel read the file as UTF-8 instead of whatever the local
// codepage is, which otherwise mangles accented names in the first column.
export function csvStream(
  header: string[],
  rows: AsyncIterable<CsvCell[]>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = rows[Symbol.asyncIterator]();
  let headerWritten = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerWritten) {
        headerWritten = true;
        controller.enqueue(encoder.encode(`\uFEFF${csvLine(header)}`));
        return;
      }
      try {
        const next = await iterator.next();
        if (next.done === true) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(csvLine(next.value)));
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
