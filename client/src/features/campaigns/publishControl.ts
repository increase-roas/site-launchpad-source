import type {
  FunnelPublishStatus,
  FunnelPublishStep,
  SimpleFormPublishStatusView,
} from "@shared/simpleFormPublish";

type PublishStateLike = {
  status: FunnelPublishStatus;
  step: FunnelPublishStep;
};

type VersionedPublishStateLike = PublishStateLike & {
  updatedAt: Date;
};

export type PublishAdvanceControllerState = {
  locked: boolean;
  pausedAfterErrorVersion: number | null;
};

export type PublishAdvanceController = {
  cancelScheduled: () => void;
  completeError: () => void;
  completeRequest: () => void;
  dispose: () => void;
  getState: () => PublishAdvanceControllerState;
  observeSuccessfulStatus: (publish: VersionedPublishStateLike) => void;
  resetForStart: () => void;
  retry: (publish: VersionedPublishStateLike, request: () => void) => boolean;
  scheduleAutomatic: (
    publish: VersionedPublishStateLike,
    delay: number,
    request: () => void
  ) => void;
};

export const initialPublishAdvanceControllerState: PublishAdvanceControllerState = {
  locked: false,
  pausedAfterErrorVersion: null,
};

function publishVersion(publish: VersionedPublishStateLike): number {
  return publish.updatedAt.getTime();
}

export function isPublishPausedAfterError(
  publish: VersionedPublishStateLike | null,
  pausedAfterErrorVersion: number | null
): boolean {
  return Boolean(
    publish &&
      pausedAfterErrorVersion !== null &&
      publishVersion(publish) <= pausedAfterErrorVersion
  );
}

export function createPublishAdvanceController(
  onStateChange: (state: PublishAdvanceControllerState) => void = () => {}
): PublishAdvanceController {
  let disposed = false;
  let latestSuccessfulVersion: number | null = null;
  let attemptedVersion: number | null = null;
  let state = { ...initialPublishAdvanceControllerState };
  let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

  const notify = () => onStateChange({ ...state });
  const cancelScheduled = () => {
    if (timeout === null) return;
    globalThis.clearTimeout(timeout);
    timeout = null;
  };
  const requestAdvance = (
    publish: VersionedPublishStateLike,
    request: () => void
  ): boolean => {
    if (
      disposed ||
      state.locked ||
      isPublishPausedAfterError(publish, state.pausedAfterErrorVersion)
    ) {
      return false;
    }
    state = { ...state, locked: true };
    attemptedVersion = publishVersion(publish);
    notify();
    request();
    return true;
  };

  return {
    cancelScheduled,
    completeError: () => {
      if (
        disposed ||
        attemptedVersion === null ||
        (latestSuccessfulVersion !== null &&
          latestSuccessfulVersion > attemptedVersion)
      ) {
        return;
      }
      state = {
        ...state,
        pausedAfterErrorVersion: attemptedVersion,
      };
      notify();
    },
    completeRequest: () => {
      if (disposed) return;
      attemptedVersion = null;
      if (!state.locked) return;
      state = { ...state, locked: false };
      notify();
    },
    dispose: () => {
      disposed = true;
      cancelScheduled();
    },
    getState: () => ({ ...state }),
    observeSuccessfulStatus: publish => {
      if (disposed) return;
      const version = publishVersion(publish);
      latestSuccessfulVersion = Math.max(
        latestSuccessfulVersion ?? version,
        version
      );
      if (
        state.pausedAfterErrorVersion === null ||
        version <= state.pausedAfterErrorVersion
      ) {
        return;
      }
      state = { ...state, pausedAfterErrorVersion: null };
      notify();
    },
    resetForStart: () => {
      if (disposed) return;
      cancelScheduled();
      if (state.pausedAfterErrorVersion === null) return;
      state = { ...state, pausedAfterErrorVersion: null };
      notify();
    },
    retry: (publish, request) => {
      if (disposed || state.locked) return false;
      cancelScheduled();
      if (state.pausedAfterErrorVersion !== null) {
        state = { ...state, pausedAfterErrorVersion: null };
        notify();
      }
      return requestAdvance(publish, request);
    },
    scheduleAutomatic: (publish, delay, request) => {
      cancelScheduled();
      if (
        disposed ||
        !shouldAutoAdvancePublish(publish) ||
        state.locked ||
        isPublishPausedAfterError(publish, state.pausedAfterErrorVersion)
      ) {
        return;
      }
      timeout = globalThis.setTimeout(() => {
        timeout = null;
        requestAdvance(publish, request);
      }, delay);
    },
  };
}

export function effectivePublishStatus<T extends VersionedPublishStateLike>(
  ...candidates: Array<T | null | undefined>
): T | null {
  let effective: T | null = null;
  for (const candidate of candidates) {
    if (
      candidate &&
      (!effective || publishVersion(candidate) > publishVersion(effective))
    ) {
      effective = candidate;
    }
  }
  return effective;
}

export function publishAdvanceDelayMs(
  publish: Pick<
    SimpleFormPublishStatusView,
    "status" | "step" | "dispatchRequestedAt"
  >
): number {
  if (publish.status === "running") return 3_000;
  if (
    publish.step === "monitor_workflow" ||
    (publish.step === "dispatch_workflow" && publish.dispatchRequestedAt)
  ) {
    return 2_000;
  }
  return 0;
}

export function publishActionLabel(
  publish: PublishStateLike | null
): "Publish" | "Retry" | null {
  if (!publish) return "Publish";
  if (publish.status === "published") return null;
  return "Retry";
}

export function publishActionForState(
  publish: VersionedPublishStateLike | null,
  pausedAfterErrorVersion: number | null
): "Publish" | "Retry" | null {
  if (isPublishPausedAfterError(publish, pausedAfterErrorVersion)) {
    return "Retry";
  }
  return shouldAutoAdvancePublish(publish) ? null : publishActionLabel(publish);
}

export function shouldAutoAdvancePublish(
  publish: PublishStateLike | null
): boolean {
  return Boolean(
    publish &&
      (publish.status === "pending" || publish.status === "running") &&
      publish.step !== "published"
  );
}

export function publishPollInterval(
  publish: PublishStateLike | null | undefined
): 3_000 | false {
  return shouldAutoAdvancePublish(publish ?? null) ? 3_000 : false;
}

export function publishProgressPercent(progress: {
  completed: number;
  total: number;
}): number {
  if (progress.total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((progress.completed / progress.total) * 100))
  );
}

export function publishStepLabel(step: FunnelPublishStep): string {
  switch (step) {
    case "create_repository":
      return "Creating repository";
    case "ensure_kv_namespace":
      return "Configuring session storage";
    case "ensure_d1_database":
      return "Configuring funnel database";
    case "ensure_queues":
      return "Configuring retry queues";
    case "commit_source":
      return "Committing generated source";
    case "dispatch_workflow":
      return "Starting deployment workflow";
    case "monitor_workflow":
      return "Monitoring deployment";
    case "patch_runtime_secrets":
      return "Installing runtime secrets";
    case "get_live_url":
      return "Checking workers.dev";
    case "published":
      return "Published";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

/** Published order of the inventory cards, moved without a drag surface. */
export function reorderSimpleFormProducts<T>(
  products: readonly T[],
  from: number,
  to: number
): T[] {
  if (from === to || from < 0 || to < 0 || from >= products.length || to >= products.length) {
    return [...products];
  }
  const next = [...products];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...products];
  next.splice(to, 0, moved);
  return next;
}
