import { describe, expect, it } from "vitest";
import {
  SITE_NAV_INCLUDES_TEMPLATES,
  createBlankDraft,
  createDraftFromFixture,
  intakeImportedArchive,
  isTemplatesSiteNavPath,
  libraryFromRegistry,
  libraryPrimaryAction,
  libraryTemplates,
  paidAdsFunnelsPath,
  resolveRegistryTemplates,
  parseFunnelWorkspaceView,
} from "./funnelLibrary";

describe("paid ads funnel library navigation", () => {
  it("keeps templates inside Paid Ads / Funnels and never adds site Templates nav", () => {
    expect(SITE_NAV_INCLUDES_TEMPLATES).toBe(false);
    expect(isTemplatesSiteNavPath("/templates")).toBe(true);
    expect(paidAdsFunnelsPath(9)).toBe("/workspace/9/funnels?tab=my-funnels");
    expect(paidAdsFunnelsPath(9, "templates")).toBe("/workspace/9/funnels?tab=templates");
    expect(paidAdsFunnelsPath(9, "my-funnels")).toBe("/workspace/9/funnels?tab=my-funnels");
    expect(paidAdsFunnelsPath(9, "builder", "generic-paid-funnel-9")).toContain("/workspace/9/funnels?builder=");
    expect(parseFunnelWorkspaceView("")).toEqual({ tab: "my-funnels", builderId: null });
    expect(parseFunnelWorkspaceView("tab=my-funnels")).toEqual({ tab: "my-funnels", builderId: null });
    expect(parseFunnelWorkspaceView("tab=templates")).toEqual({ tab: "templates", builderId: null });
    expect(libraryTemplates()[0]?.kind).toBe("paid-funnel");
    expect(createDraftFromFixture(3).draft.kind).toBe("paid-funnel");
    expect(libraryPrimaryAction()).toBe("Create blank funnel");
    const blank = createBlankDraft(3, "Northland Spas");
    expect(blank.draft.kind).toBe("paid-funnel");
    expect(blank.graph.steps).toHaveLength(1);
    expect(blank.graph.pages.landing.sections).toEqual([]);
    expect(blank.graph.steps.map(step => step.key)).not.toContain("form");
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

  it("keeps the generic fixture visible when registry loading fails", () => {
    const failed = resolveRegistryTemplates({
      remote: undefined,
      isLoading: true,
      errorMessage: "Templates could not be loaded.",
    });
    expect(failed.templatesLoading).toBe(false);
    expect(failed.errorMessage).toBe("Templates could not be loaded.");
    expect(failed.templates[0]?.templateKey).toBe("generic-paid-funnel");
    expect(failed.templates[0]?.stepCount).toBe(5);
  });

  it("does not hide Create behind a spinner when the registry is still pending", () => {
    const pending = resolveRegistryTemplates({
      remote: undefined,
      isLoading: true,
      errorMessage: null,
    });
    expect(pending.templatesLoading).toBe(false);
    expect(pending.templates.map(item => item.templateKey)).toEqual(["generic-paid-funnel"]);
  });
});
