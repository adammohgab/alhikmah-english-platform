/**
 * Builds a short reference shown on the error page. It contains no error details.
 * The sequence makes IDs distinct even when multiple errors occur in the same millisecond.
 */
let errorIdSequence = 0;

export function createErrorId(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().slice(-5);
  const sequence = (errorIdSequence++ % 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `ERR-${time}-${sequence}`;
}

/** Path under the app's base URL (the router's basename), for plain links outside the router. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}
