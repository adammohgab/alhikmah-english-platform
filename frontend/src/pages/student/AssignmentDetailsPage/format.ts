export function formatWordTarget(min?: number, max?: number): string {
  if (min != null && max != null) return `${min}-${max} words`;
  if (min != null) return `At least ${min} words`;
  if (max != null) return `Up to ${max} words`;
  return "No word count target";
}

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}
