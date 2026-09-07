import { describe, expect, it } from "vitest";
import { liveDomainConnectDialog, publishStartLabel } from "./liveDomainConnect";

describe("publishStartLabel", () => {
  it("asks to connect the live domain after a workers.dev publish", () => {
    expect(
      publishStartLabel({
        liveUrl: "https://website-north-star-5.increase-roas.workers.dev",
      }),
    ).toBe("Connect live domain");
  });

  it("keeps republish and first publish labels for real domains", () => {
    expect(publishStartLabel({ liveUrl: "https://www.theclient.com" })).toBe(
      "Publish again",
    );
    expect(publishStartLabel({ liveUrl: null })).toBe("Publish again");
    expect(publishStartLabel(null)).toBe("Publish");
  });
});

describe("liveDomainConnectDialog", () => {
  it("confirms the saved Site URL host against the current workers.dev address", () => {
    expect(
      liveDomainConnectDialog({
        siteUrl: "https://www.theclient.com/about",
        currentLiveUrl: "https://website-north-star-5.increase-roas.workers.dev",
      }),
    ).toEqual({
      kind: "ready",
      hostname: "www.theclient.com",
      title: "Connect live domain",
      description:
        "Attach www.theclient.com to this production Worker? Production is currently on website-north-star-5.increase-roas.workers.dev.",
      confirmLabel: "Connect www.theclient.com",
    });
  });

  it("blocks when the Site URL is missing", () => {
    expect(
      liveDomainConnectDialog({
        siteUrl: "  ",
        currentLiveUrl: "https://website-north-star-5.increase-roas.workers.dev",
      }),
    ).toEqual({
      kind: "blocked",
      title: "Cannot connect live domain",
      description:
        "Set a HTTPS Site URL in Basic Info and save it before connecting the live domain.",
    });
  });

  it("blocks when the Site URL is still a workers.dev or preview address", () => {
    expect(
      liveDomainConnectDialog({
        siteUrl: "https://website-north-star-5.increase-roas.workers.dev",
        currentLiveUrl: "https://website-north-star-5.increase-roas.workers.dev",
      }).description,
    ).toMatch(/real domain/);
  });

  it("blocks when the Site URL is not HTTPS", () => {
    expect(
      liveDomainConnectDialog({
        siteUrl: "http://www.theclient.com",
        currentLiveUrl: "https://website-north-star-5.increase-roas.workers.dev",
      }).description,
    ).toMatch(/https:\/\//);
  });
});
