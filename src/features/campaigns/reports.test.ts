import { describe, expect, it } from "vitest";
import { type CampaignReportSummary, campaignRates, ratio } from "./reportsShared";

const SUMMARY: CampaignReportSummary = {
  recipients: 120,
  sent: 100,
  delivered: 95,
  opens: 70,
  uniqueOpens: 40,
  uniqueOpensAll: 60,
  machineOpens: 20,
  clicks: 25,
  uniqueClicks: 20,
  unsubscribes: 5,
  bouncesHard: 3,
  bouncesSoft: 2,
  complaints: 1,
};

describe("campaign rate formulas", () => {
  it("divides every rate by delivered, and click-to-open by unique opens", () => {
    const rates = campaignRates(SUMMARY, false);
    expect(rates.openRate).toBeCloseTo(40 / 95, 10);
    expect(rates.clickRate).toBeCloseTo(20 / 95, 10);
    expect(rates.ctor).toBeCloseTo(20 / 40, 10);
    expect(rates.unsubscribeRate).toBeCloseTo(5 / 95, 10);
    expect(rates.bounceRate).toBeCloseTo(5 / 95, 10);
  });

  it("excludes machine opens by default and includes them on request", () => {
    expect(campaignRates(SUMMARY, false).openRate).toBeCloseTo(40 / 95, 10);
    expect(campaignRates(SUMMARY, true).openRate).toBeCloseTo(60 / 95, 10);
  });

  it("renders a missing denominator as null, which the UI shows as a dash", () => {
    const empty: CampaignReportSummary = {
      ...SUMMARY,
      sent: 0,
      delivered: 0,
      uniqueOpens: 0,
      uniqueOpensAll: 0,
      uniqueClicks: 0,
      unsubscribes: 0,
      bouncesHard: 0,
      bouncesSoft: 0,
    };
    const rates = campaignRates(empty, false);
    expect(rates.openRate).toBeNull();
    expect(rates.clickRate).toBeNull();
    expect(rates.ctor).toBeNull();
    expect(rates.unsubscribeRate).toBeNull();
    expect(rates.bounceRate).toBeNull();
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(0, 4)).toBe(0);
  });
});
