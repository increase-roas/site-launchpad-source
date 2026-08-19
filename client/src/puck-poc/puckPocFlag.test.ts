import { describe, expect, it } from "vitest";
import { isPuckPocEnabled } from "./puckPocFlag";

describe("puck poc flag", () => {
  it("enables with VITE_PUCK_POC=1", () => {
    expect(isPuckPocEnabled("", "1")).toBe(true);
  });

  it("enables with ?puck=1 without replacing paid ads", () => {
    expect(isPuckPocEnabled("?puck=1", undefined)).toBe(true);
    expect(isPuckPocEnabled("?tab=templates", undefined)).toBe(false);
    expect(isPuckPocEnabled("", undefined)).toBe(false);
  });
});
