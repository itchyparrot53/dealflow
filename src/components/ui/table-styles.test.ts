import { describe, expect, it } from "vitest";
import { tableStyles } from "./table-styles";

describe("tableStyles", () => {
  it("keeps header and body rows at the measured 33 px", () => {
    expect(tableStyles.th).toContain("h-[33px]");
    expect(tableStyles.tr).toContain("h-[33px]");
    expect(tableStyles.td).toContain("h-[33px]");
  });

  it("draws the strong header rule and the light cell grid from tokens", () => {
    expect(tableStyles.thead).toContain("border-border-strong");
    expect(tableStyles.th).toContain("border-grid");
    expect(tableStyles.tr).toContain("border-grid");
  });

  it("gives record links the green role and numbers a right-aligned tabular style", () => {
    expect(tableStyles.link).toContain("text-link-record");
    expect(tableStyles.numeric).toContain("text-right");
    expect(tableStyles.numeric).toContain("tabular");
  });
});
