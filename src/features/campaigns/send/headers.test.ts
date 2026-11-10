import { describe, expect, it } from "vitest";
import { campaignHeaders, campaignSubject } from "./headers";

const INPUT = {
  campaignId: "c0000000-0000-4000-8000-000000000001",
  recipientId: "r0000000-0000-4000-8000-000000000002",
  campaignType: "announcement",
  baseUrl: "https://app.example.com",
  unsubscribeOneClickUrl: "https://app.example.com/u/token/one-click",
};

describe("campaign headers", () => {
  it("sets the one-click unsubscribe pair and bulk markers", () => {
    const headers = campaignHeaders(INPUT);
    expect(headers["List-Unsubscribe"]).toBe("<https://app.example.com/u/token/one-click>");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(headers.Precedence).toBe("bulk");
    expect(headers["X-Dealflow-Campaign"]).toBe(INPUT.campaignId);
    expect(headers["Feedback-ID"]).toBe(`${INPUT.campaignId}:announcement:dealflow`);
  });

  it("derives a deterministic Message-ID from both ids and the sender domain", () => {
    const first = campaignHeaders(INPUT)["Message-ID"];
    const second = campaignHeaders(INPUT)["Message-ID"];
    expect(first).toBe(second);
    expect(first).toBe(`<${INPUT.campaignId}.${INPUT.recipientId}@app.example.com>`);
  });

  it("strips CR and LF from the subject", () => {
    expect(campaignSubject("Hello\r\nBcc: victim@example.com")).toBe(
      "Hello Bcc: victim@example.com",
    );
  });
});
