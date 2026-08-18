export type AutosaveDocument = {
  saveStatus: "saved" | "saving" | "error";
  editSeq: number;
  lastSavedEditSeq?: number;
  revision: number;
  funnelId?: number;
  stepId?: number;
  expectedUpdatedAt?: string;
  conflict: boolean;
};

export type AutosaveState = {
  document: AutosaveDocument;
};

export type AutosaveFlight = {
  inFlightEditSeq: number | null;
  request: AutosaveRequest | null;
};

export type AutosaveRequest = {
  sessionId: number;
  clientId: number;
  funnelId: number;
  stepId: number;
  editSeq: number;
};

export type AutosavePersist = {
  expectedUpdatedAt?: string;
  stepId?: number;
};

export function createAutosaveFlight(): AutosaveFlight {
  return { inFlightEditSeq: null, request: null };
}

export function lastSavedEditSeq(document: AutosaveDocument): number {
  return document.lastSavedEditSeq ?? 0;
}

export function studioHasUnsavedWork(document: AutosaveDocument): boolean {
  return document.saveStatus === "saving" || document.saveStatus === "error" || document.editSeq !== lastSavedEditSeq(document);
}

export function shouldStartAutosave(input: {
  document: AutosaveDocument;
  flight: AutosaveFlight;
  isPending: boolean;
}): boolean {
  if (input.document.saveStatus !== "saving") return false;
  if (!input.document.funnelId || !input.document.stepId || !input.document.expectedUpdatedAt) return false;
  if (input.isPending || input.flight.inFlightEditSeq != null) return false;
  return true;
}

export function beginAutosave(request: AutosaveRequest): AutosaveFlight {
  return { inFlightEditSeq: request.editSeq, request };
}

export function autosaveRequestMatches(
  flight: AutosaveFlight,
  request: AutosaveRequest,
): boolean {
  const active = flight.request;
  return Boolean(
    active
      && active.sessionId === request.sessionId
      && active.clientId === request.clientId
      && active.funnelId === request.funnelId
      && active.stepId === request.stepId
      && active.editSeq === request.editSeq,
  );
}

export function autosaveDocumentMatches(
  document: AutosaveDocument,
  request: AutosaveRequest,
): boolean {
  return document.funnelId === request.funnelId && document.stepId === request.stepId;
}

export function finishAutosave<T extends AutosaveState>(
  state: T,
  savedEditSeq: number,
  persist?: AutosavePersist,
): T {
  const persistedCurrent = savedEditSeq === state.document.editSeq;
  return {
    ...state,
    document: {
      ...state.document,
      revision: persistedCurrent ? state.document.revision + 1 : state.document.revision,
      saveStatus: persistedCurrent ? "saved" : "saving",
      conflict: false,
      lastSavedEditSeq: savedEditSeq,
      expectedUpdatedAt: persist?.expectedUpdatedAt ?? state.document.expectedUpdatedAt,
      stepId: persist?.stepId ?? state.document.stepId,
    },
  };
}

export function resolveAutosave<T extends AutosaveState>(input: {
  state: T;
  flight: AutosaveFlight;
  savedEditSeq: number;
  persist?: AutosavePersist;
}): { state: T; flight: AutosaveFlight; needsResave: boolean } {
  const state = finishAutosave(input.state, input.savedEditSeq, input.persist);
  return {
    state,
    flight: createAutosaveFlight(),
    needsResave: state.document.saveStatus === "saving" && state.document.editSeq !== lastSavedEditSeq(state.document),
  };
}

export function dirtyNavigationMessage(): string {
  return "You have unsaved paid-funnel edits. Leave anyway?";
}

export function confirmDirtyNavigation(document: AutosaveDocument, confirmLeave: () => boolean): boolean {
  if (!studioHasUnsavedWork(document)) return true;
  return confirmLeave();
}
