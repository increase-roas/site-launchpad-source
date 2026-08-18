import { describe, expect, it } from "vitest";
import { getAnalyticsScriptConfig } from "./analytics";

describe("optional analytics configuration", () => {
  it("omits analytics when either production variable is missing", () => {
    expect(getAnalyticsScriptConfig({})).toBeNull();
    expect(
      getAnalyticsScriptConfig({
        VITE_ANALYTICS_ENDPOINT: "https://analytics.example.com",
      })
    ).toBeNull();
    expect(
      getAnalyticsScriptConfig({ VITE_ANALYTICS_WEBSITE_ID: "site-1" })
    ).toBeNull();
  });

  it("builds the analytics script URL only from a valid configured endpoint", () => {
    expect(
      getAnalyticsScriptConfig({
        VITE_ANALYTICS_ENDPOINT: "https://analytics.example.com/base",
        VITE_ANALYTICS_WEBSITE_ID: "site-1",
      })
    ).toEqual({
      src: "https://analytics.example.com/base/umami",
      websiteId: "site-1",
    });
    expect(
      getAnalyticsScriptConfig({
        VITE_ANALYTICS_ENDPOINT: "javascript:alert(1)",
        VITE_ANALYTICS_WEBSITE_ID: "site-1",
      })
    ).toBeNull();
  });
});
