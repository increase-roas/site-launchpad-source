import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SIMPLE_FORM_MANIFEST,
  SIMPLE_FORM_SECRET_GUIDES,
  simpleFormManifestSchema,
} from "./simpleFormContract";

describe("Simple Form template contract", () => {
  it("parses runtime metadata from the vendored launchpad.template.json", () => {
    const raw = JSON.parse(
      readFileSync("server/templates/simple-form/launchpad.template.json", "utf8"),
    );
    expect(simpleFormManifestSchema.parse(raw)).toEqual(SIMPLE_FORM_MANIFEST);
    expect(readFileSync("shared/simpleFormContract.ts", "utf8")).toContain(
      "server/templates/simple-form/launchpad.template.json",
    );
  });

  it("rejects malformed runtime manifest metadata", () => {
    expect(() =>
      simpleFormManifestSchema.parse({
        ...SIMPLE_FORM_MANIFEST,
        shape: "B",
      }),
    ).toThrow();
  });

  it("describes CRM secret reveal behavior accurately", () => {
    const crmGuide = SIMPLE_FORM_SECRET_GUIDES.find(
      guide => guide.runtimeKey === "CRM_CALLBACK_SECRET",
    );
    expect(crmGuide?.whereToFind).toContain("Reveal secret");
    expect(crmGuide?.whereToFind).not.toContain("Show once");

    const editor = readFileSync(
      "client/src/components/funnels/SimpleFormFunnelEditor.tsx",
      "utf8",
    );
    expect(editor).toContain(
      "Revealing displays the currently stored secret. Keep it private.",
    );
    expect(editor).not.toContain("Show once");
  });
});
