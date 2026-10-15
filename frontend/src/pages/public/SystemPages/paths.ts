/** Path under the app's base URL (the router's basename), for full page loads. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Accepts a "come back here" path only when it is an in-app path that cannot loop back to
 * the offline page or leave the site. Anything else returns null.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value === "/offline" || value.startsWith("/offline?") || value.startsWith("/offline/")) {
    return null;
  }
  return value;
}
