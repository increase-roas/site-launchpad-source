import { describe, expect, it } from "vitest";
import {
  editorInstanceKey,
  nextSerializedSave,
  saveClientIdForMountedEditor,
  selectedFunnelForClient,
  shouldAdoptRemoteFormAfterSave,
  shouldClearDirtyAfterSave,
  shouldHydrateEditor,
  shouldHydrateHomepageSections,
  shouldHydrateRemoteForm,
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

  it("skips remote hydrate while the local form fingerprint differs", () => {
    expect(shouldHydrateRemoteForm('{"name":"A"}', '{"name":"A"}')).toBe(true);
    expect(shouldHydrateRemoteForm('{"name":"B"}', '{"name":"A"}')).toBe(false);
    expect(shouldHydrateRemoteForm(null, null)).toBe(true);
  });

  it("clears funnel selection that does not belong to the mounted client", () => {
    expect(selectedFunnelForClient(12, [12, 15])).toBe(12);
    expect(selectedFunnelForClient(12, [8, 9])).toBeNull();
    expect(selectedFunnelForClient(null, [8])).toBeNull();
  });

  it("queues homepage saves while one persist is in flight", () => {
    expect(nextSerializedSave(false)).toBe("send");
    expect(nextSerializedSave(true)).toBe("queue");
  });

  it("does not adopt server questions when the live form moved during save", () => {
    expect(shouldAdoptRemoteFormAfterSave('{"name":"A"}', '{"name":"A"}')).toBe(true);
    expect(shouldAdoptRemoteFormAfterSave('{"name":"A"}', '{"name":"B"}')).toBe(false);
  });

  it("keeps a dirty homepage draft after a failed persist instead of hydrating remote order", () => {
    expect(
      shouldHydrateHomepageSections({
        inFlight: false,
        hasQueued: true,
        localSerialized: '[{"id":1}]',
        lastCleanSerialized: '[{"id":2}]',
      }),
    ).toBe(false);
    expect(
      shouldHydrateHomepageSections({
        inFlight: false,
        hasQueued: false,
        localSerialized: '[{"id":1,"enabled":true}]',
        lastCleanSerialized: '[{"id":1,"enabled":false}]',
      }),
    ).toBe(false);
    expect(
      shouldHydrateHomepageSections({
        inFlight: false,
        hasQueued: false,
        localSerialized: '[{"id":1}]',
        lastCleanSerialized: '[{"id":1}]',
      }),
    ).toBe(true);
  });
});
