import { describe, expect, it } from "vitest";
import {
  createRowClickSuppressor,
  isClientBoardInteractiveTarget,
  shouldOpenClientFromRowClick,
} from "./clientRowActions";

describe("client board row actions", () => {
  it("does not open a client from the leftover click after Delete is chosen", () => {
    const gate = createRowClickSuppressor(250);
    gate.suppress();

    expect(
      shouldOpenClientFromRowClick({
        defaultPrevented: false,
        isInteractiveTarget: false,
        isSuppressed: gate.isSuppressed(Date.now()),
      }),
    ).toBe(false);
  });

  it("treats a menu item as an interactive target so Delete is not a row open", () => {
    expect(
      isClientBoardInteractiveTarget({
        closest: selector => (selector.includes("[role='menuitem']") ? {} : null),
      }),
    ).toBe(true);
  });
});
