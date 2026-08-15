import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIMPLE_FORM_MANIFEST, simpleFormManifestSchema } from "./simpleFormContract";

describe("Simple Form template contract", () => {
  it("matches the vendored launchpad.template.json", () => {
    const raw = JSON.parse(
      readFileSync("server/templates/simple-form/launchpad.template.json", "utf8"),
    );
    expect(simpleFormManifestSchema.parse(raw)).toEqual(SIMPLE_FORM_MANIFEST);
  });
});
