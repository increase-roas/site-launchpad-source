import { describe, expect, it } from "vitest";
import { FUNNEL_SHAPES } from "./workspace";

describe("workspace defaults", () => {
  it("preserves the exact required Shape A, B, and C flows", () => {
    expect(FUNNEL_SHAPES.A.map(step => step.stepType)).toEqual(["zip", "thankYou"]);
    expect(FUNNEL_SHAPES.B.map(step => step.stepType)).toEqual([
      "zip",
      "survey",
      "contact",
      "thankYou",
    ]);
    expect(FUNNEL_SHAPES.C.map(step => step.stepType)).toEqual([
      "zip",
      "survey",
      "contact",
      "book",
      "thankYou",
    ]);
  });
});
