import type { AssetUploadResult } from "@/lib/assetUpload";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ResolvedMediaSlot } from "./mediaSlots";
import { planPlaceholderFill } from "./placeholderMedia";
import { renderPlaceholderImage } from "./renderPlaceholderImage";

export type PlaceholderFillProgress = {
  running: boolean;
  done: number;
  total: number;
  failed: number;
  error: string | null;
};

const IDLE: PlaceholderFillProgress = {
  running: false,
  done: 0,
  total: 0,
  failed: 0,
  error: null,
};

type UploadSlot = (slot: ResolvedMediaSlot, file: File) => Promise<AssetUploadResult>;

/**
 * Development convenience: fills empty media slots with generated stand-in
 * artwork through the ordinary upload path, so the rest of the app sees exactly
 * what it would see after a real upload. Slots that already hold an image are
 * never touched.
 */
export function useDevPlaceholderFill({
  enabled,
  autoRun,
  slots,
  uploadSlot,
}: {
  enabled: boolean;
  autoRun: boolean;
  slots: ResolvedMediaSlot[];
  uploadSlot: UploadSlot;
}): { progress: PlaceholderFillProgress; missingCount: number; start: () => void } {
  const [progress, setProgress] = useState<PlaceholderFillProgress>(IDLE);
  const runningRef = useRef(false);
  const autoRunDoneRef = useRef(false);

  // The upload loop must not restart when a completed upload re-renders the tab.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const uploadSlotRef = useRef(uploadSlot);
  uploadSlotRef.current = uploadSlot;

  const missingCount = slots.filter(slot => !slot.added).length;

  const start = useCallback(() => {
    if (runningRef.current) return;
    const pending = slotsRef.current.filter(slot => !slot.added);
    if (pending.length === 0) return;

    runningRef.current = true;
    setProgress({ running: true, done: 0, total: pending.length, failed: 0, error: null });

    void (async () => {
      let done = 0;
      let failed = 0;
      let error: string | null = null;
      const byId = new Map(pending.map(slot => [slot.id, slot]));

      for (const descriptor of planPlaceholderFill(pending)) {
        const slot = byId.get(descriptor.slotId);
        if (!slot) continue;
        try {
          const result = await uploadSlotRef.current(
            slot,
            await renderPlaceholderImage(descriptor),
          );
          if (result.ok) {
            done += 1;
          } else {
            failed += 1;
            error ??= result.message;
          }
        } catch (thrown) {
          failed += 1;
          error ??= thrown instanceof Error ? thrown.message : "The image could not be generated.";
        }
        setProgress({ running: true, done, total: pending.length, failed, error });
      }

      runningRef.current = false;
      setProgress({ running: false, done, total: pending.length, failed, error });
      if (failed > 0 && error) {
        toast.error(`${failed} of ${pending.length} images failed: ${error}`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!enabled || !autoRun || autoRunDoneRef.current) return;
    autoRunDoneRef.current = true;
    start();
  }, [enabled, autoRun, start]);

  return { progress, missingCount, start };
}
