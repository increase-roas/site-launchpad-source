import { describe, expect, it } from "vitest";
import { BUSINESS_DAY_VALUES } from "./client";
import {
  createDefaultAstroConfig,
  emptyWranglerSecretStatus,
  type AstroClientConfigInput,
} from "./astroConfig";
import {
  CONFIG_SECTION_IDS,
  CONFIG_TAB_SECTIONS,
  REQUIRED_ASSET_SLOTS,
  describeBasicTabGap,
  describeTabGap,
  fieldStateFor,
  isBasicTabComplete,
  meterFromCounts,
  sectionForPath,
  staticRequiredPaths,
  summarizeAstroConfigReadiness,
} from "./astroConfigReadiness";

function baseConfig(): AstroClientConfigInput {
  return createDefaultAstroConfig({
    businessName: "Fargo Hot Tubs",
    shortName: "Fargo Tubs",
    foundedYear: 2011,
    tagline: "Relax in Fargo",
    websiteUrl: "https://fargohottubs.com",
    phone: "+17015551234",
    email: "hello@fargohottubs.com",
    streetAddress: "1420 Dakota Ave",
    city: "Fargo",
    state: "ND",
    postalCode: "58103",
    country: "US",
    businessHours: BUSINESS_DAY_VALUES.map(day => ({
      day,
      isOpen: true,
      opensAt: "09:00",
      closesAt: "17:00",
    })),
    facebookUrl: "",
    theme: "aqua",
  });
}

const allAssets = REQUIRED_ASSET_SLOTS.map(slot => ({ slot }));

describe("static required-path probe", () => {
  const paths = staticRequiredPaths();

  it("treats min-length strings as required", () => {
    expect(paths).toContain("address.city");
    expect(paths).toContain("address.postalCode");
    expect(paths).toContain("identity.businessName");
    expect(paths).toContain("identity.siteUrl");
    expect(paths).toContain("contact.phone");
    expect(paths).toContain("contact.email");
  });

  it("treats empty-accepting strings as optional", () => {
    expect(paths).not.toContain("address.street2");
    expect(paths).not.toContain("address.latitude");
    expect(paths).not.toContain("address.longitude");
    expect(paths).not.toContain("address.googlePlaceId");
    expect(paths).not.toContain("contact.smsPhone");
    expect(paths).not.toContain("contact.phoneDisplayOverride");
    expect(paths).not.toContain("brand.fonts.googleFontsUrl");
  });

  it("treats every social link as optional", () => {
    for (const network of [
      "facebook",
      "instagram",
      "youtube",
      "tiktok",
      "x",
      "linkedin",
      "googleBusiness",
    ]) {
      expect(paths).not.toContain(`socialLinks.${network}`);
    }
  });

  it("maps every required path to a known section", () => {
    for (const path of paths) {
      expect(sectionForPath(path), path).not.toBeNull();
    }
  });
});

describe("section and tab wiring", () => {
  it("assigns every section to exactly one tab", () => {
    const assigned = Object.values(CONFIG_TAB_SECTIONS).flat();
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(new Set(assigned)).toEqual(new Set(CONFIG_SECTION_IDS));
  });
});

describe("meterFromCounts", () => {
  it("reports a full count as complete", () => {
    expect(meterFromCounts(4, 4)).toMatchObject({ incomplete: 0, state: "complete" });
  });

  it("reports a partial count as incomplete without inventing invalids", () => {
    expect(meterFromCounts(1, 4)).toMatchObject({
      requiredFilled: 1,
      incomplete: 3,
      invalid: 0,
      state: "incomplete",
    });
  });

  it("treats an empty group as complete rather than dividing by zero", () => {
    expect(meterFromCounts(0, 0)).toMatchObject({ incomplete: 0, state: "complete" });
  });
});

describe("summarizeAstroConfigReadiness", () => {
  it("reports a fully populated config as ready", () => {
    const readiness = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    expect(readiness.unmapped).toEqual([]);
    expect(readiness.ready).toBe(true);
    expect(readiness.sections.address.state).toBe("complete");
    expect(readiness.tabs.basic.state).toBe("complete");
  });

  it("counts a blank required field as incomplete, not invalid", () => {
    const config = baseConfig();
    config.address.postalCode = "";
    const readiness = summarizeAstroConfigReadiness(config, allAssets);

    expect(readiness.sections.address.incomplete).toBe(1);
    expect(readiness.sections.address.invalid).toBe(0);
    expect(readiness.sections.address.state).toBe("incomplete");
    expect(fieldStateFor(readiness, "address.postalCode")).toBe("incomplete");
    expect(readiness.tabs.basic.state).toBe("incomplete");
    expect(readiness.ready).toBe(false);
  });

  it("counts a filled but rejected field as invalid", () => {
    const config = baseConfig();
    config.identity.siteUrl = "fargohottubs";
    const readiness = summarizeAstroConfigReadiness(config, allAssets);

    expect(readiness.sections.identity.invalid).toBe(1);
    expect(readiness.sections.identity.incomplete).toBe(0);
    expect(readiness.sections.identity.state).toBe("invalid");
    expect(fieldStateFor(readiness, "identity.siteUrl")).toBe("invalid");
  });

  it("does not double count a blank required field in the denominator", () => {
    const filled = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    const config = baseConfig();
    config.address.city = "";
    const blanked = summarizeAstroConfigReadiness(config, allAssets);

    expect(blanked.sections.address.requiredTotal).toBe(
      filled.sections.address.requiredTotal,
    );
    expect(blanked.sections.address.requiredFilled).toBe(
      filled.sections.address.requiredFilled - 1,
    );
  });

  it("ignores a disabled category but counts an enabled incomplete one", () => {
    const disabled = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    expect(disabled.sections.categories.requiredTotal).toBe(0);

    const config = baseConfig();
    config.categories["hot-tubs"] = {
      ...config.categories["hot-tubs"],
      enabled: true,
      label: "",
      description: "",
      heroImage: "",
    };
    const enabled = summarizeAstroConfigReadiness(config, allAssets);
    expect(enabled.sections.categories.incomplete).toBeGreaterThan(0);
    expect(enabled.sections.categories.state).toBe("incomplete");
  });

  it("treats optional fields as optional rather than complete", () => {
    const readiness = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    expect(fieldStateFor(readiness, "address.street2", { optional: true })).toBe("optional");
    expect(fieldStateFor(readiness, "address.city")).toBe("complete");
  });

  it("derives media readiness from required asset slots", () => {
    const none = summarizeAstroConfigReadiness(baseConfig(), []);
    expect(none.sections.media.requiredTotal).toBe(REQUIRED_ASSET_SLOTS.length);
    expect(none.sections.media.incomplete).toBe(REQUIRED_ASSET_SLOTS.length);
    expect(none.sections.media.state).toBe("incomplete");

    const all = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    expect(all.sections.media.state).toBe("complete");
  });
});

describe("technical tab readiness counts client credentials", () => {
  function statusWithAdminSecrets() {
    const status = emptyWranglerSecretStatus();
    status.ADMIN_PASSWORD = true;
    status.ADMIN_SESSION_SECRET = true;
    return status;
  }

  it("never reports the technical tab complete on an empty count", () => {
    const readiness = summarizeAstroConfigReadiness(
      baseConfig(),
      allAssets,
      emptyWranglerSecretStatus(),
    );
    expect(readiness.tabs.technical.requiredTotal).toBeGreaterThan(0);
    expect(readiness.tabs.technical.state).toBe("incomplete");
  });

  it("requires only the always-needed admin credentials when every integration is off", () => {
    const readiness = summarizeAstroConfigReadiness(
      baseConfig(),
      allAssets,
      emptyWranglerSecretStatus(),
    );
    expect(readiness.sections.clientIntegrations).toMatchObject({
      requiredTotal: 2,
      requiredFilled: 0,
      incomplete: 2,
      state: "incomplete",
    });
  });

  it("adds the credentials of an integration that was switched on", () => {
    const config = baseConfig();
    config.integrations.ghl.enabled = true;
    const readiness = summarizeAstroConfigReadiness(
      config,
      allAssets,
      statusWithAdminSecrets(),
    );
    expect(readiness.sections.clientIntegrations).toMatchObject({
      requiredTotal: 4,
      requiredFilled: 2,
      incomplete: 2,
    });
  });

  it("is complete once the credentials the site actually needs are present", () => {
    const readiness = summarizeAstroConfigReadiness(
      baseConfig(),
      allAssets,
      statusWithAdminSecrets(),
    );
    expect(readiness.sections.clientIntegrations.state).toBe("complete");
    expect(readiness.tabs.technical.state).toBe("complete");
  });

  it("counts nothing for callers that do not know the credential status", () => {
    const readiness = summarizeAstroConfigReadiness(baseConfig(), allAssets);
    expect(readiness.sections.clientIntegrations.requiredTotal).toBe(0);
    expect(readiness.ready).toBe(true);
  });
});

describe("Basic tab gap for the client-setup step", () => {
  it("is complete when identity, contact, address, and hours are filled", () => {
    const readiness = summarizeAstroConfigReadiness(baseConfig());
    expect(isBasicTabComplete(readiness)).toBe(true);
    expect(describeBasicTabGap(readiness)).toBeUndefined();
  });

  it("names the unfinished Basic section", () => {
    const config = baseConfig();
    config.contact.phone = "";
    const readiness = summarizeAstroConfigReadiness(config);
    expect(isBasicTabComplete(readiness)).toBe(false);
    expect(describeBasicTabGap(readiness)).toBe("Contact is incomplete");
  });

  it("names invalid identity values instead of leftover client-row fields", () => {
    const config = baseConfig();
    config.identity.siteUrl = "fargohottubs";
    const readiness = summarizeAstroConfigReadiness(config);
    expect(describeBasicTabGap(readiness)).toBe("Identity has invalid values");
  });

  it("names unfinished branding and media the same way", () => {
    const none = summarizeAstroConfigReadiness(baseConfig(), []);
    expect(describeTabGap(none, "media")).toBe("Media is incomplete");
    expect(describeTabGap(none, "branding")).toBeUndefined();
  });
});
