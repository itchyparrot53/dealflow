import { describe, expect, it } from "vitest";
import { specialUseOf } from "./specialUse";

describe("specialUseOf", () => {
  it("strips the backslash IMAP servers send", () => {
    expect(specialUseOf("\\Inbox")).toBe("inbox");
    expect(specialUseOf("\\Sent")).toBe("sent");
    expect(specialUseOf("\\Junk")).toBe("junk");
    expect(specialUseOf("\\Trash")).toBe("trash");
    expect(specialUseOf("\\Archive")).toBe("archive");
  });

  it("accepts a flag without the backslash and in any case", () => {
    expect(specialUseOf("sent")).toBe("sent");
    expect(specialUseOf("SENT")).toBe("sent");
  });

  it("maps unknown and missing flags to null", () => {
    expect(specialUseOf("\\All")).toBeNull();
    expect(specialUseOf("")).toBeNull();
    expect(specialUseOf(undefined)).toBeNull();
    expect(specialUseOf(null)).toBeNull();
  });
});
