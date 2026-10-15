import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Select } from "./Select";

/* ========================================
   Arcade Pagination (GLOBAL-STYLES-SPEC §10 "Button", §10.1 "Dense data screens")

   A fully controlled `<nav>`: page numbers, previous and next buttons, a "Showing x to y of z"
   line and an optional page size select. It owns no state, so the page and the page size can
   live in the URL (`?page=3&pageSize=25`) and stay in sync.

   Behavior
     Pages are 1-based, which matches a `?page=` param. A page above the last page (a stale URL)
     renders as the last page; nothing is called until the person acts, so no redirect loop.
     The number of slots stays the same while paging, so the buttons never shift under the
     pointer. Big ranges collapse to "1 ... 4 5 6 ... 20" with `siblingCount` pages around the
     current one. The current page is a primary button with `aria-current="page"`.
     Changing the page size keeps the first visible item on screen: the new page is computed
     from that item and passed to `onPageSizeChange` together with the new size, so one URL
     update carries both values and the list does not jump to page 1.
     Below the `sm` breakpoint the numbers collapse to "Page x of y".

   Keyboard: every control is a native button (Tab, Enter, Space). The select follows the Radix
   Select model (see Select.tsx).

   Usage with the URL (react-router):
     const [params, setParams] = useSearchParams();
     const page = Number(params.get("page") ?? 1);
     const pageSize = Number(params.get("pageSize") ?? 10);
     <Pagination
       page={page}
       pageSize={pageSize}
       totalItems={total}
       onPageChange={(next) => setParams((p) => { p.set("page", String(next)); return p; })}
       onPageSizeChange={(size, next) =>
         setParams((p) => { p.set("pageSize", String(size)); p.set("page", String(next)); return p; })}
     />
   ======================================== */

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Items per page. */
  pageSize: number;
  /** Total number of items across all pages. */
  totalItems: number;
  onPageChange: (page: number) => void;
  /**
   * Shows the page size select. Receives the new size and the page that keeps the first
   * visible item on screen. Update both values together.
   */
  onPageSizeChange?: ((pageSize: number, page: number) => void) | undefined;
  /** Default `[10, 25, 50]`. The current size is always included. */
  pageSizeOptions?: readonly number[] | undefined;
  /** Page buttons shown on each side of the current page. Default `1`. */
  siblingCount?: number | undefined;
  /** Accessible name of the navigation landmark. Default "Pagination". */
  label?: string | undefined;
  className?: string | undefined;
}

type PageItem = number | "gap-start" | "gap-end";

const DEFAULT_PAGE_SIZES: readonly number[] = [10, 25, 50];

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(to - from + 1, 0) }, (_, index) => from + index);
}

/** Always returns `2 * siblings + 5` slots once the range is long, so the width never changes. */
function getPageItems(page: number, pageCount: number, siblings: number): PageItem[] {
  const slots = siblings * 2 + 5;
  if (pageCount <= slots) return range(1, pageCount);

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const gapStart = left > 3;
  const gapEnd = right < pageCount - 2;
  const edge = 3 + siblings * 2;

  if (!gapStart && gapEnd) return [...range(1, edge), "gap-end", pageCount];
  if (gapStart && !gapEnd) return [1, "gap-start", ...range(pageCount - edge + 1, pageCount)];
  return [1, "gap-start", ...range(left, right), "gap-end", pageCount];
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  siblingCount = 1,
  label = "Pagination",
  className,
}: PaginationProps) {
  const size = Math.max(1, Math.floor(pageSize));
  const total = Math.max(0, Math.floor(totalItems));
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(Math.floor(page) || 1, 1), pageCount);
  const siblings = Math.max(0, Math.floor(siblingCount));

  const items = useMemo(
    () => getPageItems(current, pageCount, siblings),
    [current, pageCount, siblings],
  );
  const sizes = useMemo(
    () => Array.from(new Set([...pageSizeOptions, size])).sort((a, b) => a - b),
    [pageSizeOptions, size],
  );

  const from = total === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(total, current * size);

  const goTo = (next: number) => {
    const target = Math.min(Math.max(next, 1), pageCount);
    if (target !== current) onPageChange(target);
  };

  const changeSize = (value: string) => {
    const nextSize = Number(value);
    if (!onPageSizeChange || !Number.isFinite(nextSize) || nextSize < 1 || nextSize === size) {
      return;
    }
    const nextCount = Math.max(1, Math.ceil(total / nextSize));
    const nextPage = Math.min(Math.floor(((current - 1) * size) / nextSize) + 1, nextCount);
    onPageSizeChange(nextSize, nextPage);
  };

  return (
    <nav
      aria-label={label}
      className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}
    >
      <p aria-live="polite" className="font-body text-[14px] text-muted">
        {total === 0 ? "No items" : `Showing ${from} to ${to} of ${total}`}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="font-body text-[14px] text-stroke">Per page</span>
            <Select
              aria-label="Items per page"
              className="w-24"
              value={String(size)}
              onValueChange={changeSize}
              options={sizes.map((option) => ({ value: String(option), label: String(option) }))}
            />
          </div>
        )}

        <ul className="m-0 flex list-none items-center gap-1.5 p-0">
          <li>
            <IconButton
              aria-label="Previous page"
              size="sm"
              variant="secondary"
              disabled={current <= 1}
              onClick={() => goTo(current - 1)}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            </IconButton>
          </li>

          <li className="px-2 font-body text-[14px] text-stroke sm:hidden">
            Page {current} of {pageCount}
          </li>

          {items.map((item) =>
            typeof item === "number" ? (
              <li key={`page-${item}`} className="hidden sm:block">
                <Button
                  size="sm"
                  variant={item === current ? "primary" : "secondary"}
                  aria-label={`Page ${item}`}
                  aria-current={item === current ? "page" : undefined}
                  onClick={() => goTo(item)}
                  className="min-w-9"
                >
                  {item}
                </Button>
              </li>
            ) : (
              <li
                key={item}
                aria-hidden="true"
                className="hidden px-1 font-heading text-[14px] font-semibold text-muted sm:block"
              >
                …
              </li>
            ),
          )}

          <li>
            <IconButton
              aria-label="Next page"
              size="sm"
              variant="secondary"
              disabled={current >= pageCount}
              onClick={() => goTo(current + 1)}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            </IconButton>
          </li>
        </ul>
      </div>
    </nav>
  );
}
