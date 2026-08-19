export function isPuckPocEnabled(
  search = "",
  env: string | undefined = undefined,
): boolean {
  if (env === "1" || env === "true") return true;
  try {
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("puck") === "1";
  } catch {
    return false;
  }
}
