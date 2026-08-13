export function editorInstanceKey(clientId: number): number {
  return clientId;
}

export function shouldHydrateEditor(hydratedForClientId: number | null, clientId: number): boolean {
  return hydratedForClientId !== clientId;
}

export function saveClientIdForMountedEditor(mountedClientId: number, routeClientId: number): number | null {
  if (mountedClientId !== routeClientId) return null;
  return routeClientId;
}

export function shouldQueueTrailingSave(dirty: boolean, saveIsPending: boolean): boolean {
  return dirty && saveIsPending;
}

export function shouldHydrateRemoteForm(
  currentFingerprint: string | null,
  lastHydratedFingerprint: string | null,
): boolean {
  if (lastHydratedFingerprint == null || currentFingerprint == null) return true;
  return currentFingerprint === lastHydratedFingerprint;
}

export function selectedFunnelForClient(requestedId: number | null, ownedIds: number[]): number | null {
  if (requestedId == null) return null;
  return ownedIds.includes(requestedId) ? requestedId : null;
}

export function nextSerializedSave(inFlight: boolean): "send" | "queue" {
  return inFlight ? "queue" : "send";
}

export function shouldClearDirtyAfterSave(savedPayload: string, currentPayload: string): boolean {
  return savedPayload === currentPayload;
}
