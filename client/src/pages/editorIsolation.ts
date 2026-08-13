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

export function shouldClearDirtyAfterSave(savedPayload: string, currentPayload: string): boolean {
  return savedPayload === currentPayload;
}
