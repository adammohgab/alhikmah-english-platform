import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Drawer } from "./Drawer";
import { IconButton } from "./IconButton";
import { Select } from "./Select";
import { SearchField } from "./SearchField";

/* ========================================
   Arcade FilterBar (GLOBAL-STYLES-SPEC §10 "Input", "Chip and tag", "Drawer", §10.1)

   A fully controlled toolbar: search field, filter chip groups, a sort select, a grid/list view
   toggle and a row of removable tags for every active filter. It owns no filter state, so the
   values can live in the URL search params and stay in sync (see "Usage").

   Layout
     md and up   search, sort and view toggle in one row, the chip groups under it.
     below md    search on its own row; a "Filters" button (with a count) opens the groups in a
                 slide-over drawer. Sort and view stay in the toolbar.
   The mobile filter drawer uses the shared Drawer component, which traps focus, closes on Escape
   or backdrop click, and returns focus to the "Filters" button. It also closes when the window
   grows to the md layout.

   Behavior
     Search     Typing is debounced (`searchDelay`, default 250 ms) before `onSearchChange`, so
                the URL gets one update per pause, not one per key. Enter commits at once. The
                clear button and every removal commit at once. The field follows the `search`
                prop, so Clear all and back/forward navigation update it.
     Chips      A group is multi-select unless `multiple: false`. Selected chips use the `main`
                fill and a check, and expose `aria-pressed`.
     Tags       One removable tag per selected option, plus one for the search text. Removing
                is instant. Focus moves to the first remaining tag, or to the search field.
     Clear all  Calls `onClearAll` once. That callback must reset the search and every group,
                ideally in one URL update.

   Keyboard: all controls are native buttons or inputs (Tab, Enter, Space). Backspace or Delete
   on a tag removes it (Chip). Escape closes the drawer.

   Usage with the URL (react-router):
     const [params, setParams] = useSearchParams();
     const values: FilterValues = { level: params.getAll("level"), skill: params.getAll("skill") };
     <FilterBar
       search={params.get("q") ?? ""}
       onSearchChange={(q) => setParams((p) => { q ? p.set("q", q) : p.delete("q"); p.delete("page"); return p; })}
       filters={groups}
       filterValues={values}
       onFilterChange={(id, next) => setParams((p) => { p.delete(id); next.forEach((v) => p.append(id, v)); p.delete("page"); return p; })}
       onClearAll={() => setParams({})}
     />
   Reset `page` whenever a filter changes, so the list never shows an empty page.
   ======================================== */

export interface FilterOption {
  /** Unique value inside its group. This is what lands in the URL. */
  value: string;
  label: string;
}

export interface FilterGroup {
  /** Key of the group in `filterValues` and in the URL. */
  id: string;
  /** Visible group heading. */
  label: string;
  options: readonly FilterOption[];
  /** `false` allows one option at a time. Default `true`. */
  multiple?: boolean | undefined;
}

/** Selected option values by group id. */
export type FilterValues = Readonly<Record<string, readonly string[]>>;

export interface SortOption {
  value: string;
  label: string;
}

export type FilterBarView = "grid" | "list";

export interface FilterBarProps {
  /** Accessible name of the toolbar. Default "Search and filters". */
  label?: string | undefined;

  /** The committed search text. */
  search: string;
  onSearchChange: (search: string) => void;
  searchPlaceholder?: string | undefined;
  /** Accessible name of the search field. Default "Search". */
  searchLabel?: string | undefined;
  /** Debounce before typing is committed, in ms. Default `250`. */
  searchDelay?: number | undefined;

  filters?: readonly FilterGroup[] | undefined;
  filterValues?: FilterValues | undefined;
  onFilterChange?: ((groupId: string, values: string[]) => void) | undefined;
  /** Resets the search and every group. Shows the "Clear all" button. */
  onClearAll?: (() => void) | undefined;

  sortOptions?: readonly SortOption[] | undefined;
  sort?: string | undefined;
  onSortChange?: ((sort: string) => void) | undefined;

  /** Shows the grid/list toggle when both `view` and `onViewChange` are set. */
  view?: FilterBarView | undefined;
  onViewChange?: ((view: FilterBarView) => void) | undefined;

  className?: string | undefined;
}

const NO_VALUES: readonly string[] = [];
const EMPTY_VALUES: FilterValues = {};

interface ActiveTag {
  key: string;
  label: string;
  removeLabel: string;
  remove: () => void;
}

/* ---------- Search field ---------- */

function DebouncedSearchField({
  value,
  onCommit,
  label,
  placeholder,
  delay,
  inputRef,
  resetKey,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder: string | undefined;
  delay: number;
  inputRef: RefObject<HTMLInputElement>;
  /** Changes when Clear all runs, so a pending (not yet committed) draft is dropped too. */
  resetKey: number;
}) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const commitRef = useRef(onCommit);
  useLayoutEffect(() => {
    commitRef.current = onCommit;
  });

  // Follow the parent (Clear all, back/forward navigation), but ignore our own echo.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (resetKey === 0) return;
    committed.current = "";
    setDraft("");
  }, [resetKey]);

  const commit = (next: string) => {
    if (next === committed.current) return;
    committed.current = next;
    commitRef.current(next);
  };

  useEffect(() => {
    if (draft === committed.current) return undefined;
    const timer = window.setTimeout(() => commit(draft), delay);
    return () => window.clearTimeout(timer);
    // `commit` only reads refs, so it is safe to leave out.
  }, [draft, delay]);

  return (
    <SearchField
      ref={inputRef}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onSearch={commit}
      onClear={() => {
        setDraft("");
        commit("");
        inputRef.current?.focus();
      }}
      className="min-w-0 flex-1"
    />
  );
}

/* ---------- Chip groups (inline on md and up, inside the drawer below) ---------- */

function FilterGroups({
  groups,
  values,
  onToggle,
  className,
}: {
  groups: readonly FilterGroup[];
  values: FilterValues;
  onToggle: (group: FilterGroup, value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {groups.map((group) => {
        const selected = values[group.id] ?? NO_VALUES;
        return (
          <fieldset key={group.id} className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 font-heading text-[14px] font-semibold text-stroke">
              {group.label}
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <Chip
                  key={option.value}
                  selected={selected.includes(option.value)}
                  onClick={() => onToggle(group, option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/* ---------- FilterBar ---------- */

export function FilterBar({
  label = "Search and filters",
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel = "Search",
  searchDelay = 250,
  filters,
  filterValues = EMPTY_VALUES,
  onFilterChange,
  onClearAll,
  sortOptions,
  sort,
  onSortChange,
  view,
  onViewChange,
  className,
}: FilterBarProps) {
  const groups = filters ?? [];
  const searchRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLUListElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Leaving the narrow layout while the drawer is open would strand it: close it.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(min-width: 768px)");
    const handleChange = () => {
      if (query.matches) setDrawerOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  /* ----- filter state helpers ----- */
  const toggleOption = (group: FilterGroup, value: string) => {
    const current = filterValues[group.id] ?? NO_VALUES;
    const has = current.includes(value);
    let next: string[];
    if (group.multiple === false) next = has ? [] : [value];
    else next = has ? current.filter((entry) => entry !== value) : [...current, value];
    onFilterChange?.(group.id, next);
  };

  const tags: ActiveTag[] = [];
  const trimmedSearch = search.trim();
  if (trimmedSearch !== "") {
    tags.push({
      key: "search",
      label: `Search: ${trimmedSearch}`,
      removeLabel: "Remove search filter",
      remove: () => onSearchChange(""),
    });
  }
  for (const group of groups) {
    for (const value of filterValues[group.id] ?? NO_VALUES) {
      const optionLabel = group.options.find((option) => option.value === value)?.label ?? value;
      tags.push({
        key: `${group.id}:${value}`,
        label: `${group.label}: ${optionLabel}`,
        removeLabel: `Remove filter ${group.label} ${optionLabel}`,
        remove: () => {
          const current = filterValues[group.id] ?? NO_VALUES;
          onFilterChange?.(
            group.id,
            current.filter((entry) => entry !== value),
          );
        },
      });
    }
  }

  const activeFilterCount = tags.length - (trimmedSearch === "" ? 0 : 1);

  // The removed tag unmounts, so hand focus to the next tag, or to the search field.
  const removeTag = (tag: ActiveTag) => {
    tag.remove();
    requestAnimationFrame(() => {
      const next = tagsRef.current?.querySelector<HTMLElement>("button");
      (next ?? searchRef.current)?.focus();
    });
  };

  const clearAll = () => {
    setResetKey((key) => key + 1);
    onClearAll?.();
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const showView = view !== undefined && onViewChange !== undefined;
  const showSort =
    sortOptions !== undefined && sortOptions.length > 0 && onSortChange !== undefined;

  return (
    <section aria-label={label} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full min-w-0 items-center gap-3 md:w-auto md:min-w-[16rem] md:max-w-md md:flex-1">
          <DebouncedSearchField
            value={search}
            onCommit={onSearchChange}
            label={searchLabel}
            placeholder={searchPlaceholder}
            delay={searchDelay}
            inputRef={searchRef}
            resetKey={resetKey}
          />
        </div>

        {groups.length > 0 && (
          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="Filters"
            closeLabel="Close filters"
            size="sm"
            trigger={
              <Button variant="outline" className="md:hidden">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-stroke bg-surface-0 px-1 font-body text-[12px] font-bold">
                    {activeFilterCount}
                    <span className="sr-only"> active</span>
                  </span>
                )}
              </Button>
            }
            footer={
              <div className="flex w-full items-center justify-between gap-3">
                {onClearAll ? (
                  <Button variant="ghost" onClick={clearAll}>
                    Clear all
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={() => setDrawerOpen(false)}>Done</Button>
              </div>
            }
          >
            <FilterGroups
              groups={groups}
              values={filterValues}
              onToggle={toggleOption}
              className="flex flex-col gap-6"
            />
          </Drawer>
        )}

        {showSort && (
          <div className="min-w-0 flex-1 md:w-52 md:flex-none">
            <Select
              aria-label="Sort by"
              placeholder="Sort by"
              value={sort ?? ""}
              onValueChange={onSortChange}
              options={sortOptions}
            />
          </div>
        )}

        {showView && (
          <div role="group" aria-label="View mode" className="flex items-center gap-1.5">
            <IconButton
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              size="md"
              variant={view === "grid" ? "primary" : "secondary"}
              onClick={() => onViewChange("grid")}
            >
              <LayoutGrid aria-hidden="true" className="h-5 w-5" />
            </IconButton>
            <IconButton
              aria-label="List view"
              aria-pressed={view === "list"}
              size="md"
              variant={view === "list" ? "primary" : "secondary"}
              onClick={() => onViewChange("list")}
            >
              <List aria-hidden="true" className="h-5 w-5" />
            </IconButton>
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <FilterGroups
          groups={groups}
          values={filterValues}
          onToggle={toggleOption}
          className="hidden flex-wrap gap-x-8 gap-y-4 md:flex"
        />
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-[14px] text-muted">Active filters</span>
          <ul ref={tagsRef} className="m-0 flex list-none flex-wrap gap-2 p-0">
            {tags.map((tag) => (
              <li key={tag.key}>
                <Chip size="sm" removeLabel={tag.removeLabel} onRemove={() => removeTag(tag)}>
                  {tag.label}
                </Chip>
              </li>
            ))}
          </ul>
          {onClearAll && (
            <Button size="sm" variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
