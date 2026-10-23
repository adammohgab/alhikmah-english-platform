/**
 * Builds the short reference shown on the error page ("Error ID") so a person can quote it
 * to their school. It is generated per crash from the clock and a random part; it carries
 * no information about the error itself.
 */
let errorIdSequence = 0;

export function createErrorId(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().slice(-5);
  // A monotonic component guarantees uniqueness even when crypto returns duplicate bytes.
  const sequence = (errorIdSequence++ % 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `ERR-${time}-${sequence}`;
}

function createRandomErrorId(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().slice(-5);
  let random = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    random = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
      .join("")
      .toUpperCase()
      .slice(0, 4);
  } else {
    random = Math.floor(Math.random() * 36 ** 4)
      .toString(36)
      .toUpperCase()
      .padStart(4, "0");
  }
  return `ERR-${time}-${random}`;
}

/** Path under the app's base URL (the router's basename), for plain links outside the router. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}
