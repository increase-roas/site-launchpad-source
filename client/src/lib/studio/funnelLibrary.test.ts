import { describe, expect, it } from "vitest";
import {
  SITE_NAV_INCLUDES_TEMPLATES,
  createDraftFromFixture,
  intakeImportedArchive,
  isTemplatesSiteNavPath,
  libraryFromRegistry,
  libraryTemplates,
  paidAdsFunnelsPath,
  parseFunnelWorkspaceView,
} from "./funnelLibrary";

describe("paid ads funnel library navigation", () => {
  it("keeps templates inside Paid Ads / Funnels and never adds site Templates nav", () => {
    expect(SITE_NAV_INCLUDES_TEMPLATES).toBe(false);
    expect(isTemplatesSiteNavPath("/templates")).toBe(true);
    expect(paidAdsFunnelsPath(9, "templates")).toBe("/workspace/9/funnels?tab=templates");
    expect(paidAdsFunnelsPath(9, "my-funnels")).toBe("/workspace/9/funnels?tab=my-funnels");
    expect(paidAdsFunnelsPath(9, "builder", "generic-paid-funnel-9")).toContain("/workspace/9/funnels?builder=");
    expect(parseFunnelWorkspaceView("tab=my-funnels")).toEqual({ tab: "my-funnels", builderId: null });
    expect(libraryTemplates()[0]?.kind).toBe("paid-funnel");
    expect(createDraftFromFixture(3).draft.kind).toBe("paid-funnel");
  });

  it("treats ZIP import as intake only", () => {
    const result = intakeImportedArchive(
      [{ path: "launchpad.template.json", size: 40 }, { path: "index.html", size: 40 }],
      { archiveName: "funnel.zip", archiveBytes: 80 },
    );
    expect(result.intake.ok).toBe(true);
    expect(result.detect?.status).toBe("ready");
  });

  it("lists registry templates and my funnels instead of only local fixtures", () => {
    const listed = libraryFromRegistry(
      [
        { templateKey: "generic-paid-funnel", name: "Generic" },
        { templateKey: "imported-offer", name: "Imported" },
      ],
      [{ id: 21, name: "Northland Paid Funnel" }],
    );
    expect(listed.templates.map(item => item.templateKey)).toEqual([
      "generic-paid-funnel",
      "imported-offer",
    ]);
    expect(listed.funnels.map(item => item.id)).toEqual([21]);
    expect(listed.templates).not.toEqual([libraryTemplates()[0]]);
  });
});
