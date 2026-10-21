import { describe, expect, it } from "vitest";
import { csvLine, csvStream } from "./csv";

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  // ignoreBOM: true keeps the BOM in the decoded string so the test can assert it.
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function rows(lines: string[][]): AsyncIterable<string[]> {
  let index = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string[]>> {
          const line = lines[index];
          index += 1;
          if (line === undefined) return Promise.resolve({ done: true, value: undefined });
          return Promise.resolve({ done: false, value: line });
        },
      };
    },
  };
}

describe("csvLine", () => {
  it("joins cells with commas and ends the line in CRLF", () => {
    expect(csvLine(["a", "b", 3])).toBe("a,b,3\r\n");
    expect(csvLine([])).toBe("\r\n");
  });

  it("writes a null cell as an empty field", () => {
    expect(csvLine(["a", null, "c"])).toBe("a,,c\r\n");
  });

  it("quotes cells containing a comma, a quote or a newline", () => {
    expect(csvLine(["Acme, Inc."])).toBe('"Acme, Inc."\r\n');
    expect(csvLine(['say "hi"'])).toBe('"say ""hi"""\r\n');
    expect(csvLine(["line one\nline two"])).toBe('"line one\nline two"\r\n');
    expect(csvLine(["carriage\rreturn"])).toBe('"carriage\rreturn"\r\n');
  });

  it("leaves a plain cell unquoted", () => {
    expect(csvLine(["plain", "with space", "-1.00"])).toBe("plain,with space,'-1.00\r\n");
  });

  it("guards every formula leader with an apostrophe", () => {
    expect(csvLine(["=SUM(A1)"])).toBe("'=SUM(A1)\r\n");
    expect(csvLine(["+1"])).toBe("'+1\r\n");
    expect(csvLine(["-1"])).toBe("'-1\r\n");
    expect(csvLine(["@x"])).toBe("'@x\r\n");
    expect(csvLine(["\tcell"])).toBe("'\tcell\r\n");
    expect(csvLine(["\rcell"])).toBe('"\'\rcell"\r\n');
  });
});

describe("csvStream", () => {
  it("starts with a UTF-8 BOM, then the header and rows", async () => {
    const out = await collect(csvStream(["Name", "Value"], rows([["Acme", "1.00"]])));
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toBe("\uFEFFName,Value\r\nAcme,1.00\r\n");
  });

  it("writes only the BOM and header when there are no rows", async () => {
    const out = await collect(csvStream(["Name"], rows([])));
    expect(out).toBe("\uFEFFName\r\n");
  });
});
