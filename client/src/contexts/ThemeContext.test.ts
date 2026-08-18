import { describe, expect, it } from "vitest";
import { resolveStoredTheme } from "./ThemeContext";

describe("dashboard theme preference", () => {
  it("defaults to light when no valid preference has been saved", () => {
    expect(resolveStoredTheme(null, "light")).toBe("light");
    expect(resolveStoredTheme("system", "light")).toBe("light");
  });

  it("preserves an explicit light or dark operator preference", () => {
    expect(resolveStoredTheme("light", "dark")).toBe("light");
    expect(resolveStoredTheme("dark", "light")).toBe("dark");
  });
});
