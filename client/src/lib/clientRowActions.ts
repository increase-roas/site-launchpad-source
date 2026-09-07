const INTERACTIVE_ROW_SELECTOR = "a, button, [role='menuitem']";

export function isClientBoardInteractiveTarget(
  target: { closest?: (selector: string) => unknown } | null,
): boolean {
  return Boolean(target?.closest?.(INTERACTIVE_ROW_SELECTOR));
}

export function shouldOpenClientFromRowClick(input: {
  defaultPrevented: boolean;
  isInteractiveTarget: boolean;
  isSuppressed: boolean;
}): boolean {
  return !input.defaultPrevented && !input.isInteractiveTarget && !input.isSuppressed;
}

export function createRowClickSuppressor(holdMs = 300) {
  let blockedUntil = 0;
  return {
    suppress() {
      blockedUntil = Date.now() + holdMs;
    },
    isSuppressed(now = Date.now()) {
      return now < blockedUntil;
    },
  };
}
