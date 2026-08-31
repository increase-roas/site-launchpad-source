import { describe, expect, it } from "vitest";
import { WIZARD_STEPS } from "./wizard";
import { wizardStepHref } from "./wizardRoutes";

describe("wizard step destinations", () => {
  it("opens the configuration tab that owns each setup step", () => {
    expect(wizardStepHref("clientSetup", 9)).toBe(
      "/workspace/9/configuration?tab=basic",
    );
    expect(wizardStepHref("brandContent", 9)).toBe(
      "/workspace/9/configuration?tab=branding",
    );
    expect(wizardStepHref("mediaGallery", 9)).toBe(
      "/workspace/9/configuration?tab=media",
    );
  });

  it("opens the page that owns every other step", () => {
    expect(wizardStepHref("pages", 9)).toBe("/workspace/9/pages");
    expect(wizardStepHref("funnels", 9)).toBe("/workspace/9/campaigns");
    expect(wizardStepHref("integrations", 9)).toBe("/workspace/9/integrations");
    expect(wizardStepHref("launch", 9)).toBe("/workspace/9/launch");
  });

  it("has a destination for every wizard step", () => {
    for (const step of WIZARD_STEPS) {
      expect(wizardStepHref(step, 9)).toMatch(/^\/workspace\/9\//);
    }
  });
});
