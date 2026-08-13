import { describe, expect, it } from "vitest";
import {
  editorInstanceKey,
  saveClientIdForMountedEditor,
  shouldClearDirtyAfterSave,
  shouldHydrateEditor,
  shouldQueueTrailingSave,
} from "./editorIsolation";

describe("editor isolation", () => {
  it("uses a distinct remount key per client", () => {
    expect(editorInstanceKey(5)).toBe(5);
    expect(editorInstanceKey(9)).toBe(9);
    expect(editorInstanceKey(5)).not.toBe(editorInstanceKey(9));
  });

  it("rehydrates when the mounted client changes", () => {
    expect(shouldHydrateEditor(5, 9)).toBe(true);
    expect(shouldHydrateEditor(5, 5)).toBe(false);
    expect(shouldHydrateEditor(null, 5)).toBe(true);
  });

  it("refuses to save Client A fields onto Client B", () => {
    expect(saveClientIdForMountedEditor(5, 9)).toBeNull();
    expect(saveClientIdForMountedEditor(9, 9)).toBe(9);
  });

  it("queues a trailing save when edits arrive during an in-flight save", () => {
    expect(shouldQueueTrailingSave(true, true)).toBe(true);
    expect(shouldQueueTrailingSave(false, true)).toBe(false);
    expect(shouldQueueTrailingSave(true, false)).toBe(false);
  });

  it("keeps dirty state when the live form moved past the in-flight payload", () => {
    expect(shouldClearDirtyAfterSave('{"name":"A"}', '{"name":"A"}')).toBe(true);
    expect(shouldClearDirtyAfterSave('{"name":"A"}', '{"name":"B"}')).toBe(false);
  });
});
