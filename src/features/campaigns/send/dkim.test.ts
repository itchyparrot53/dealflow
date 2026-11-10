import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    CAMPAIGN_DKIM_DOMAIN: "",
    CAMPAIGN_DKIM_SELECTOR: "",
    CAMPAIGN_DKIM_PRIVATE_KEY: "",
    CAMPAIGN_DKIM_PRIVATE_KEY_FILE: "",
  },
}));

vi.mock("@/config/env", () => envMock);

import { dkimConfig } from "./transport";

// dkimConfig reads the single env boundary; the mock keeps this a pure unit test.
describe("campaign DKIM", () => {
  it("is off unless domain, selector and key are all set", () => {
    envMock.env.CAMPAIGN_DKIM_DOMAIN = "example.com";
    envMock.env.CAMPAIGN_DKIM_SELECTOR = "mail";
    envMock.env.CAMPAIGN_DKIM_PRIVATE_KEY = "";
    expect(dkimConfig()).toBeNull();

    envMock.env.CAMPAIGN_DKIM_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----";
    expect(dkimConfig()).toEqual({
      domain: "example.com",
      selector: "mail",
      privateKey: "-----BEGIN PRIVATE KEY-----",
    });
  });
});
