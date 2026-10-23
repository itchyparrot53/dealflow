import { describe, expect, it } from "vitest";
import { SOURCE_ORIGIN_LABELS, sourceOriginLabel } from "./sourceOriginLabel";

describe("sourceOriginLabel", () => {
  it("maps every known source origin to its written label", () => {
    expect(SOURCE_ORIGIN_LABELS).toEqual({
      web_form: "Web form",
      manually_created: "Manually created",
      import: "Import",
      outbound: "Outbound",
      referral: "Referral",
      api: "API",
    });
    expect(sourceOriginLabel("web_form")).toBe("Web form");
    expect(sourceOriginLabel("manually_created")).toBe("Manually created");
    expect(sourceOriginLabel("import")).toBe("Import");
    expect(sourceOriginLabel("outbound")).toBe("Outbound");
    expect(sourceOriginLabel("referral")).toBe("Referral");
    expect(sourceOriginLabel("api")).toBe("API");
  });

  it("title-cases an unknown value instead of showing the raw identifier", () => {
    expect(sourceOriginLabel("trade_show")).toBe("Trade Show");
    expect(sourceOriginLabel("partner-referral")).toBe("Partner Referral");
    expect(sourceOriginLabel("webForm")).toBe("Web form");
    expect(sourceOriginLabel("podcast")).toBe("Podcast");
  });

  it("trims the value and tolerates an empty one", () => {
    expect(sourceOriginLabel("  import  ")).toBe("Import");
    expect(sourceOriginLabel("")).toBe("");
  });
});
