import { describe, expect, it } from "vitest";
import { SIMPLE_FORM_TEMPLATE_KEY } from "../simpleFormContract";
import {
  inspectPaidFunnelZipIntake,
  isWebsiteTemplatesRoute,
  libraryItems,
  blankFunnelName,
  blankFunnelSlug,
  CREATE_BLANK_FUNNEL_LABEL,
  PAID_ADS_LIBRARY_TAB_ITEMS,
  PAID_ADS_PRIMARY_TAB,
  isBlankPaidFunnel,
  paidAdsBuilderPath,
  paidAdsFunnelBreadcrumbs,
  paidAdsLibraryPath,
  paidAdsSimpleFormPath,
  paidFunnelLibrarySourceLabel,
  parsePaidAdsFunnelSearch,
} from "./library";

describe("Paid Ads funnel library lives inside Funnels", () => {
  it("keeps Templates, My Funnels, ZIP, and Builder under Paid Ads / Funnels", () => {
    expect(PAID_ADS_PRIMARY_TAB).toBe("mine");
    expect(PAID_ADS_LIBRARY_TAB_ITEMS.map(([key]) => key)).toEqual(["mine", "templates"]);
    expect(paidAdsLibraryPath(4, "templates")).toBe("/workspace/4/funnels?tab=templates");
    expect(paidAdsLibraryPath(4, "mine")).toBe("/workspace/4/funnels?tab=mine");
    expect(paidAdsBuilderPath(4, "generic-paid-funnel")).toBe("/workspace/4/funnels?studio=generic-paid-funnel");
    expect(paidAdsSimpleFormPath(4, 12)).toBe("/workspace/4/funnels?funnel=12");
    expect(paidAdsLibraryPath(4, "templates")).not.toContain("/templates");
    expect(isWebsiteTemplatesRoute("/workspace/4/funnels")).toBe(false);
    expect(isWebsiteTemplatesRoute("/templates")).toBe(true);
    expect(parsePaidAdsFunnelSearch("").view).toBe("mine");
    expect(parsePaidAdsFunnelSearch("?tab=templates").view).toBe("templates");
    expect(parsePaidAdsFunnelSearch("?tab=mine").view).toBe("mine");
    expect(parsePaidAdsFunnelSearch("?studio=generic-paid-funnel").view).toBe("builder");
    expect(parsePaidAdsFunnelSearch("?funnel=12").view).toBe("simple-form");
    expect(paidAdsFunnelBreadcrumbs("Paradise", "")).toEqual(["Paradise", "Paid Ads", "Funnels", "My Funnels"]);
    expect(paidAdsFunnelBreadcrumbs("Paradise", "?tab=templates")).toEqual(["Paradise", "Paid Ads", "Funnels", "Templates"]);
    expect(paidAdsFunnelBreadcrumbs("Paradise", "?studio=x")).toEqual(["Paradise", "Paid Ads", "Funnels", "Builder"]);
    expect(libraryItems().simpleFormKey).toBe(SIMPLE_FORM_TEMPLATE_KEY);
    expect(libraryItems().zipDropzone).toBe("inside-paid-ads-funnels");
    expect(libraryItems().primaryAction).toBe(CREATE_BLANK_FUNNEL_LABEL);
    expect(libraryItems().primaryTab).toBe("mine");
    expect(libraryItems().templatesOptional).toBe(true);
  });

  it("names blank funnels without cloning a template slug", () => {
    expect(blankFunnelName("Northland Spas")).toBe("Northland Spas Funnel");
    expect(blankFunnelName("Northland Spas", ["Northland Spas Funnel"])).toBe("Northland Spas Funnel 2");
    expect(blankFunnelSlug("northland", [])).toBe("northland-funnel");
    expect(blankFunnelSlug("northland", ["northland-funnel"])).toBe("northland-funnel-2");
    expect(isBlankPaidFunnel({ source: "template", templateVersionId: null })).toBe(true);
    expect(isBlankPaidFunnel({ source: "fixture", templateVersionId: 3 })).toBe(false);
    expect(paidFunnelLibrarySourceLabel({ source: "template", templateVersionId: null })).toBe("blank");
    expect(paidFunnelLibrarySourceLabel({ source: "fixture", templateVersionId: 1 })).toBe("fixture");
  });

  it("rejects traversal, credentials, executables, and oversized ZIP intake", () => {
    expect(inspectPaidFunnelZipIntake({
      archiveName: "funnel.zip",
      byteSize: 51 * 1024 * 1024,
      files: [{ path: "index.html", byteSize: 10 }],
    }).status).toBe("rejected");
    expect(inspectPaidFunnelZipIntake({
      archiveName: "funnel.zip",
      byteSize: 10,
      files: [{ path: "../secret.html", byteSize: 10 }],
    }).errors[0]).toMatch(/traversal/i);
    expect(inspectPaidFunnelZipIntake({
      archiveName: "funnel.zip",
      byteSize: 10,
      files: [{ path: ".env", byteSize: 10 }],
    }).errors[0]).toMatch(/Credential/i);
    expect(inspectPaidFunnelZipIntake({
      archiveName: "funnel.zip",
      byteSize: 10,
      files: [{ path: "setup.sh", byteSize: 10, executable: true }],
    }).errors[0]).toMatch(/Executable/i);
  });

  it("accepts an explicit paid-funnel manifest and drafts unsupported regions", () => {
    const accepted = inspectPaidFunnelZipIntake({
      archiveName: "offer.zip",
      byteSize: 1200,
      files: [{ path: "launchpad.template.json", byteSize: 200 }, { path: "landing/index.html", byteSize: 800 }],
      manifest: { kind: "paid-funnel", graph: { schemaVersion: 1 } },
    });
    expect(accepted.status).toBe("accepted");
    const draft = inspectPaidFunnelZipIntake({
      archiveName: "offer.zip",
      byteSize: 800,
      files: [{ path: "launchpad.template.json", byteSize: 200 }],
      manifest: { kind: "paid-funnel", immutableRegions: ["header.liquid"] },
    });
    expect(draft.status).toBe("draft");
    expect(draft.errors[0]).toMatch(/Unsupported region cannot become a visual graph: header.liquid/);
    const htmlDraft = inspectPaidFunnelZipIntake({
      archiveName: "offer.zip",
      byteSize: 400,
      files: [{ path: "index.html", byteSize: 400 }],
    });
    expect(htmlDraft.status).toBe("draft");
    expect(htmlDraft.framework).toBe("static-html");
  });
});
