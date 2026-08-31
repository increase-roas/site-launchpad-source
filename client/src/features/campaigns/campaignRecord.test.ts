import { buildSimpleFormStoredRecord } from "@shared/simpleFormConfig";
import { describe, expect, it } from "vitest";
import { campaignPendingRecord, stampConsentVersion } from "./campaignRecord";

function record() {
  return buildSimpleFormStoredRecord({
    businessName: "Northland Spas",
    slug: "northland-spas-simple-form",
    phone: "+17015551234",
  });
}

describe("campaign pending record", () => {
  it("saves the ZIP textarea as a unique 5-digit list", () => {
    const pending = campaignPendingRecord(record(), "58701, 58702\n58701\n");

    expect(pending.config.serviceAreaZipCodes).toEqual(["58701", "58702"]);
  });
});

describe("consent version stamping", () => {
  const today = new Date("2026-09-14T10:30:00.000Z");

  it("restamps the version when the consent wording changes", () => {
    const baseline = record();
    const next = record();
    next.config.contact.consent.text = `${baseline.config.contact.consent.text} Reply STOP to opt out.`;

    const stamped = stampConsentVersion(next, baseline, today);

    expect(stamped.config.contact.consent.version).toBe("2026-09-14");
  });

  it("leaves the version alone when only other fields changed", () => {
    const baseline = record();
    const next = record();
    next.config.offer.headline = "See what is in stock this week";

    const stamped = stampConsentVersion(next, baseline, today);

    expect(stamped.config.contact.consent.version).toBe(
      baseline.config.contact.consent.version,
    );
  });

  it("ignores whitespace-only consent edits", () => {
    const baseline = record();
    const next = record();
    next.config.contact.consent.text = `  ${baseline.config.contact.consent.text}  `;

    expect(stampConsentVersion(next, baseline, today).config.contact.consent.version).toBe(
      baseline.config.contact.consent.version,
    );
  });
});
