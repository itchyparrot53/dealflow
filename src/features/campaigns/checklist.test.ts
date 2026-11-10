import { describe, expect, it } from "vitest";
import { auditDocument } from "./blocks/audit";
import type { CampaignDocument } from "./blocks/schema";
import { blockingFailures, campaignChecklist } from "./checklist";

const PASSING = {
  subject: "Something new",
  senderVerified: true,
  postalAddress: "1 Market Street, London",
  recipientCount: 4,
  imagesWithoutAlt: 0,
  buttonsWithoutUrl: 0,
  htmlBytes: 20_000,
  domainCheck: "pass" as const,
  testSent: true,
};

describe("campaign checklist", () => {
  it("passes everything when the campaign is ready", () => {
    const items = campaignChecklist(PASSING);
    expect(items.every((item) => item.status === "pass")).toBe(true);
    expect(blockingFailures(items)).toEqual([]);
  });

  it("fails the blocking items and keeps domain and test as warnings", () => {
    const items = campaignChecklist({
      ...PASSING,
      subject: " ",
      senderVerified: false,
      postalAddress: "",
      recipientCount: 0,
      imagesWithoutAlt: 2,
      buttonsWithoutUrl: 1,
      htmlBytes: 101 * 1024,
      domainCheck: "missing",
      testSent: false,
    });
    const failures = blockingFailures(items).map((item) => item.key);
    expect(failures).toEqual([
      "subject",
      "sender",
      "address",
      "recipients",
      "alt",
      "links",
      "size",
    ]);
    expect(items.find((item) => item.key === "domain")?.status).toBe("warning");
    expect(items.find((item) => item.key === "test")?.status).toBe("warning");
    expect(items.find((item) => item.key === "size")?.detail).toContain("90 KB");
  });
});

describe("document audit", () => {
  it("counts images without alt text, including inside columns", () => {
    const doc: CampaignDocument = {
      version: 1,
      settings: {
        backgroundColor: "#F4F4F2",
        contentWidth: 600,
        fontFamily: "system",
        linkColor: "#2D8548",
      },
      blocks: [
        {
          id: "img",
          type: "image",
          assetId: "00000000-0000-4000-8000-000000000000",
          alt: "",
          width: 100,
          align: "center",
        },
        {
          id: "cols",
          type: "columns",
          columns: [
            [{ id: "n1", type: "text", html: "<p>x</p>" }],
            [{ id: "n2", type: "text", html: "<p>y</p>" }],
          ],
        },
      ],
    };
    expect(auditDocument(doc)).toEqual({ imagesWithoutAlt: 1, buttonsWithoutUrl: 0 });
  });
});
