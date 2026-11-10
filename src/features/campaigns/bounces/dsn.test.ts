import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBounceReport } from "./dsn";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const RECIPIENT_ID = "22222222-2222-4222-8222-222222222222";

function fixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
}

describe("bounce report parser", () => {
  it("reads a Gmail hard bounce and the original campaign headers", async () => {
    const report = await parseBounceReport(fixture("gmail-hard.eml"));
    expect(report).toMatchObject({
      kind: "bounce",
      severity: "hard",
      campaignId: CAMPAIGN_ID,
      recipientId: RECIPIENT_ID,
      recipientEmail: "ada@example.com",
      status: "5.1.1",
    });
    expect(report?.diagnostic).toContain("550");
  });

  it("reads an Outlook hard bounce", async () => {
    const report = await parseBounceReport(fixture("outlook-hard.eml"));
    expect(report).toMatchObject({
      kind: "bounce",
      severity: "hard",
      campaignId: CAMPAIGN_ID,
      recipientId: RECIPIENT_ID,
      status: "5.7.1",
    });
  });

  it("reads a Postfix soft bounce", async () => {
    const report = await parseBounceReport(fixture("postfix-soft.eml"));
    expect(report).toMatchObject({
      kind: "bounce",
      severity: "soft",
      campaignId: CAMPAIGN_ID,
      recipientId: RECIPIENT_ID,
      status: "4.2.2",
    });
  });

  it("reads an ARF abuse report as a complaint", async () => {
    const report = await parseBounceReport(fixture("arf-complaint.eml"));
    expect(report).toMatchObject({
      kind: "complaint",
      severity: null,
      campaignId: CAMPAIGN_ID,
      recipientId: RECIPIENT_ID,
      recipientEmail: "ada@example.com",
      feedbackType: "abuse",
    });
  });

  it("returns null for a message that is not a report", async () => {
    const raw = Buffer.from(
      [
        "From: ada@example.com",
        "To: bounce@example.com",
        "Subject: Hello",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Just a normal message.",
      ].join("\r\n"),
    );
    expect(await parseBounceReport(raw)).toBeNull();
  });
});
