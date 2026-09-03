import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  isPreviewActive,
  previewAdvanceDelayMs,
  previewPollIntervalMs,
} from "./astroPreviewFlow";

export function useAstroPreviewJob(clientId: number | null | undefined) {
  const utils = trpc.useUtils();
  const queryInput = useMemo(
    () => (clientId ? { clientId } : { clientId: 0 }),
    [clientId],
  );
  const enabled = clientId != null && clientId > 0;
  const advanceInFlightRef = useRef(false);

  const previewQuery = trpc.astroConfig.previewStatus.useQuery(queryInput, {
    enabled,
    refetchInterval: state => previewPollIntervalMs(state.state.data),
  });
  const historyQuery = trpc.astroConfig.previewHistory.useQuery(queryInput, {
    enabled,
  });

  const startPreview = trpc.astroConfig.startPreview.useMutation({
    onSuccess: status => {
      utils.astroConfig.previewStatus.setData(queryInput, status);
      void utils.astroConfig.previewHistory.invalidate(queryInput);
    },
    onError: error => toast.error(error.message),
  });
  const advancePreview = trpc.astroConfig.advancePreview.useMutation({
    onSuccess: status => {
      utils.astroConfig.previewStatus.setData(queryInput, status);
      if (status.status === "ready") {
        void utils.astroConfig.previewHistory.invalidate(queryInput);
        toast.success("Preview ready.");
      }
    },
    onError: error => toast.error(error.message),
    onSettled: () => {
      advanceInFlightRef.current = false;
    },
  });
  const approvePreview = trpc.astroConfig.approvePreview.useMutation({
    onSuccess: status => {
      utils.astroConfig.previewStatus.setData(queryInput, status);
      toast.success("Preview approved.");
    },
    onError: error => toast.error(error.message),
  });

  const preview = previewQuery.data;
  const mutateAdvance = advancePreview.mutate;

  useEffect(() => {
    if (!enabled || !clientId) return;
    const delay = previewAdvanceDelayMs(preview);
    if (delay === null || advanceInFlightRef.current) return;
    const timer = window.setTimeout(() => {
      if (advanceInFlightRef.current) return;
      advanceInFlightRef.current = true;
      mutateAdvance({ clientId, retryFailed: false });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [clientId, enabled, mutateAdvance, preview]);

  return {
    preview,
    history: historyQuery.data ?? [],
    startPreview,
    advancePreview,
    approvePreview,
    isPreviewActive: isPreviewActive(preview),
  };
}
