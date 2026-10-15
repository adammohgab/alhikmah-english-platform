import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Button, type ButtonVariant } from "./Button";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { Select } from "./Select";

/* ========================================
   Arcade DataTable (GLOBAL-STYLES-SPEC §10 "Table", §10.1 "Dense data screens")

   Built on TanStack Table v8. Reusable for teacher rosters and admin user management.

   Look (spec §10.1): a stroke-2 container (radius 18) with a world `main` header band, white
   rows with hairline dividers, `tint` zebra, a `soft` hover tint and a `soft` fill for selected
   rows. No rotation, tilt or hover lift inside the table, and no row animation. The header is
   sticky inside the scroll area. Numbers use tabular figures. The bulk bar floats at the bottom
   of the viewport and pops in with the shared overshoot curve (spec §6.1); the "low" effects
   tier drops that motion.

   Features
     Sorting      Click a header label (or press Enter or Space on it). Click again to reverse,
                  again to clear. Shift-click adds a secondary sort. The `th` carries `aria-sort`.
     Filters      One text filter per column under its label (case-insensitive "contains").
                  Turn all off with `filterable={false}`, or one off with `enableColumnFilter: false`
                  on the column definition.
     Selection    A leading checkbox column. The header checkbox selects every row on the current
                  page and shows the mixed state. Selection survives paging, sorting and filtering.
     Pagination   Page size select, previous and next buttons, and a "Showing x to y of z" line.
     Bulk bar     Appears while at least one row is selected. Each action receives the selected
                  rows and a `clearSelection` callback.

   Keyboard (grid pattern, one tab stop for the cell grid)
     Tab                        enters the grid on the last active cell, then moves through the
                                controls inside cells (sort buttons, filters, checkboxes), then out
     Arrow keys                 move between cells (left and right flip under `dir="rtl"`)
     Home / End                 first / last cell of the row
     Ctrl + Home / Ctrl + End   first / last cell of the table
     Enter or F2                moves focus into the first control inside the focused cell
     Escape                     returns focus from a control to its cell
   Arrow keys are only handled while a cell itself has focus, so typing in a filter box and
   operating a checkbox keep their native keys.

   Usage:
     const columns = useMemo<ColumnDef<Student, any>[]>(() => [
       { accessorKey: "name", header: "Name" },
       { accessorKey: "level", header: "Level" },
     ], []);
     <DataTable
       label="Class roster"
       data={students}
       columns={columns}
       getRowId={(student) => student.id}
       bulkActions={[
         { id: "archive", label: "Archive", onAction: (rows, clear) => { archive(rows); clear(); } },
         { id: "delete", label: "Delete", variant: "danger", onAction: (rows) => remove(rows) },
       ]}
     />
   Keep `columns` and `data` referentially stable (`useMemo` or module scope) so the table does
   not rebuild its models on every render. Column definitions must be flat (no grouped headers).
   ======================================== */

export interface DataTableBulkAction<TData> {
  id: string;
  label: string;
  /** Lucide icon (16 px). Hidden from assistive tech by the caller or by `aria-hidden`. */
  icon?: ReactNode | undefined;
  /** Button variant. Default `secondary`. Use `danger` for destructive actions. */
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  /** Receives every selected row (across pages) and a callback that clears the selection. */
  onAction: (rows: TData[], clearSelection: () => void) => void;
}

export interface DataTableProps<TData> {
  /** Accessible name of the table (rendered as a visually hidden caption). */
  label: string;
  data: TData[];
  // TanStack column definitions are invariant in TValue, so `any` is the accepted escape hatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  /** Stable row id. Strongly recommended so selection survives data refreshes. */
  getRowId?: ((row: TData, index: number) => string) | undefined;
  /** Adds the checkbox column. Pass a function to allow selection for some rows only. */
  selectable?: boolean | ((row: Row<TData>) => boolean) | undefined;
  /** Floating actions shown while rows are selected. */
  bulkActions?: ReadonlyArray<DataTableBulkAction<TData>> | undefined;
  /** Accessible name of a row checkbox. Default "Select row n". */
  getRowLabel?: ((row: TData) => string) | undefined;
  /** Per-column text filters under the header labels. Default `true`. */
  filterable?: boolean | undefined;
  /** Alternating `tint` rows. Default `true`. */
  zebra?: boolean | undefined;
  /** Page size choices. Default `[10, 25, 50]`. */
  pageSizeOptions?: readonly number[] | undefined;
  /** Default `10`. */
  initialPageSize?: number | undefined;
  initialSorting?: SortingState | undefined;
  /** Height limit of the scroll area (any CSS length). Default `32rem`. */
  maxHeight?: string | undefined;
  /** Shown when no row matches. Default "No results". */
  emptyMessage?: ReactNode | undefined;
  className?: string | undefined;
}

const SELECT_COLUMN_ID = "__select";
const DEFAULT_PAGE_SIZES: readonly number[] = [10, 25, 50];

/* Overshoot on release; the "low" effects tier drops the transition (spec §8.9). */
const POP_MOTION =
  "transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

const HAIRLINE = "border-[rgba(26,21,48,0.12)]";

const CELL_FOCUS = "focus-visible:-outline-offset-4";

function headerLabel<TData>(column: Column<TData, unknown>): string {
  const { header } = column.columnDef;
  return typeof header === "string" ? header : column.id;
}

interface CellPosition {
  row: number;
  col: number;
}

function BulkBar<TData>({
  count,
  actions,
  onClear,
  onAction,
}: {
  count: number;
  actions: ReadonlyArray<DataTableBulkAction<TData>>;
  onClear: () => void;
  onAction: (action: DataTableBulkAction<TData>) => void;
}) {
  // Mounts below the fold, then flips on the next frame so the pop-in transition runs.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section
      aria-label="Bulk actions"
      className={cn(
        "fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-[18px] border-2 border-stroke bg-surface-0 px-4 py-3 shadow-retro-md",
        POP_MOTION,
        entered ? "translate-y-0" : "translate-y-[200%]",
      )}
    >
      <p className="font-heading text-[15px] font-semibold text-stroke">{count} selected</p>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant ?? "secondary"}
            disabled={action.disabled === true}
            onClick={() => onAction(action)}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <IconButton aria-label="Clear selection" size="sm" variant="ghost" onClick={onClear}>
        <X aria-hidden="true" className="h-4 w-4" />
      </IconButton>
    </section>
  );
}

export function DataTable<TData>({
  label,
  data,
  columns,
  getRowId,
  selectable = true,
  bulkActions,
  getRowLabel,
  filterable = true,
  zebra = true,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  initialPageSize = 10,
  initialSorting,
  maxHeight = "32rem",
  emptyMessage = "No results",
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [active, setActive] = useState<CellPosition>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLTableElement>(null);

  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (selectable === false) return columns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: SELECT_COLUMN_ID,
      enableSorting: false,
      enableColumnFilter: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={getRowLabel ? getRowLabel(row.original) : `Select row ${row.index + 1}`}
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, selectable, getRowLabel]);

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    ...(getRowId ? { getRowId } : {}),
    state: { sorting, columnFilters, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    enableRowSelection: selectable,
    defaultColumn: { filterFn: "includesString" },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const bodyRows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;
  const gridRowCount = headerGroups.length + bodyRows.length;
  const filteredTotal = table.getFilteredRowModel().rows.length;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const from = filteredTotal === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(filteredTotal, (pageIndex + 1) * pageSize);

  const pageSizes = useMemo(
    () => Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b),
    [pageSizeOptions, pageSize],
  );

  const firstSort = sorting[0];
  const sortedColumn = firstSort ? table.getColumn(firstSort.id) : undefined;
  const sortStatus =
    firstSort && sortedColumn
      ? `Sorted by ${headerLabel(sortedColumn)}, ${firstSort.desc ? "descending" : "ascending"}`
      : "";

  const clearSelection = useCallback(() => setRowSelection({}), []);

  // Keep the roving tab stop inside the grid when rows or columns disappear.
  const activeRow = Math.min(active.row, Math.max(gridRowCount - 1, 0));
  const activeCol = Math.min(active.col, Math.max(colCount - 1, 0));

  const focusCell = (row: number, col: number) => {
    const nextRow = Math.min(Math.max(row, 0), gridRowCount - 1);
    const nextCol = Math.min(Math.max(col, 0), colCount - 1);
    setActive({ row: nextRow, col: nextCol });
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-grid-row="${nextRow}"][data-grid-col="${nextCol}"]`)
      ?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // A control inside a cell: only Escape is ours, it hands focus back to the cell.
    if (!target.hasAttribute("data-grid-cell")) {
      if (event.key === "Escape") {
        const cell = target.closest<HTMLElement>("[data-grid-cell]");
        if (cell) {
          event.preventDefault();
          cell.focus();
        }
      }
      return;
    }

    const row = Number(target.dataset["gridRow"]);
    const col = Number(target.dataset["gridCol"]);
    const forward = getComputedStyle(target).direction === "rtl" ? -1 : 1;
    const lastRow = gridRowCount - 1;
    const lastCol = colCount - 1;

    switch (event.key) {
      case "ArrowRight":
        focusCell(row, col + forward);
        break;
      case "ArrowLeft":
        focusCell(row, col - forward);
        break;
      case "ArrowDown":
        focusCell(row + 1, col);
        break;
      case "ArrowUp":
        focusCell(row - 1, col);
        break;
      case "Home":
        if (event.ctrlKey) focusCell(0, 0);
        else focusCell(row, 0);
        break;
      case "End":
        if (event.ctrlKey) focusCell(lastRow, lastCol);
        else focusCell(row, lastCol);
        break;
      case "Enter":
      case "F2": {
        const control = target.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        );
        if (!control) return;
        control.focus();
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const barActions = bulkActions ?? [];
  const showBar = barActions.length > 0 && selectedCount > 0;

  return (
    <div className={cn("w-full", showBar && "pb-24", className)}>
      <p role="status" className="sr-only">
        {sortStatus}
      </p>
      <p role="status" className="sr-only">
        {selectedCount > 0
          ? `${selectedCount} ${selectedCount === 1 ? "row" : "rows"} selected`
          : ""}
      </p>

      <div className="overflow-hidden rounded-[18px] border-2 border-stroke bg-surface-0">
        {/* data-lenis-prevent: a table with its own overflow must scroll normally (spec §8.3). */}
        <div data-lenis-prevent="" className="overflow-auto" style={{ maxHeight }}>
          <table
            ref={gridRef}
            role="grid"
            aria-colcount={colCount}
            aria-rowcount={filteredTotal + headerGroups.length}
            onKeyDown={handleKeyDown}
            className="w-full border-separate border-spacing-0 font-body text-[14px] tabular-nums text-stroke"
          >
            <caption className="sr-only">{label}</caption>
            <thead>
              {headerGroups.map((group, groupIndex) => (
                <tr key={group.id} aria-rowindex={groupIndex + 1}>
                  {group.headers.map((header, colIndex) => {
                    const column = header.column;
                    const canSort = column.getCanSort();
                    const sorted = column.getIsSorted();
                    const isSelect = column.id === SELECT_COLUMN_ID;
                    const showFilter = filterable && column.getCanFilter();
                    const isActive = activeRow === groupIndex && activeCol === colIndex;
                    const name = headerLabel(column);
                    const filterValue = column.getFilterValue();
                    let ariaSort: "ascending" | "descending" | "none" | undefined;
                    if (canSort) {
                      if (sorted === "asc") ariaSort = "ascending";
                      else if (sorted === "desc") ariaSort = "descending";
                      else ariaSort = "none";
                    }

                    return (
                      <th
                        key={header.id}
                        role="columnheader"
                        scope="col"
                        aria-sort={ariaSort}
                        aria-colindex={colIndex + 1}
                        data-grid-cell=""
                        data-grid-row={groupIndex}
                        data-grid-col={colIndex}
                        tabIndex={isActive ? 0 : -1}
                        onFocus={() => setActive({ row: groupIndex, col: colIndex })}
                        className={cn(
                          "sticky top-0 z-10 border-b-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 py-3 text-start align-top font-heading text-[14px] font-semibold",
                          isSelect && "w-12",
                          CELL_FOCUS,
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={column.getToggleSortingHandler()}
                            className="group inline-flex items-center gap-1.5 rounded-[8px] text-start font-heading font-semibold text-stroke"
                          >
                            {flexRender(column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 [stroke-width:3]"
                              />
                            ) : sorted === "desc" ? (
                              <ArrowDown
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 [stroke-width:3]"
                              />
                            ) : (
                              <ArrowUpDown
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 opacity-60 [stroke-width:3] group-hover:opacity-100"
                              />
                            )}
                          </button>
                        ) : (
                          flexRender(column.columnDef.header, header.getContext())
                        )}
                        {showFilter && (
                          <input
                            type="text"
                            aria-label={`Filter ${name}`}
                            placeholder="Filter"
                            value={typeof filterValue === "string" ? filterValue : ""}
                            onChange={(event) =>
                              column.setFilterValue(event.target.value || undefined)
                            }
                            className="mt-2 block h-8 w-full min-w-[6rem] rounded-[10px] border-2 border-stroke bg-surface-0 px-3 font-body text-[13px] font-normal text-stroke shadow-[1px_1px_0_#000] placeholder:text-muted focus-visible:shadow-retro-sm"
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {bodyRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(colCount, 1)} className="px-4 py-10 text-center text-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                bodyRows.map((row, rowIndex) => {
                  const gridRow = headerGroups.length + rowIndex;
                  const selected = row.getIsSelected();
                  return (
                    <tr
                      key={row.id}
                      aria-rowindex={headerGroups.length + pageIndex * pageSize + rowIndex + 1}
                      aria-selected={selectable === false ? undefined : selected}
                      data-selected={selected ? "true" : undefined}
                      className={cn(
                        "bg-surface-0 hover:bg-[var(--world-soft,#ffd93d)] data-[selected=true]:bg-[var(--world-soft,#ffd93d)] last:[&>td]:border-b-0",
                        zebra && "even:bg-[var(--world-tint,#fff1e3)]",
                      )}
                    >
                      {row.getVisibleCells().map((cell, colIndex) => {
                        const isActive = activeRow === gridRow && activeCol === colIndex;
                        return (
                          <td
                            key={cell.id}
                            role="gridcell"
                            aria-colindex={colIndex + 1}
                            data-grid-cell=""
                            data-grid-row={gridRow}
                            data-grid-col={colIndex}
                            tabIndex={isActive ? 0 : -1}
                            onFocus={() => setActive({ row: gridRow, col: colIndex })}
                            className={cn(
                              "border-b px-4 py-2.5 text-start align-middle",
                              HAIRLINE,
                              CELL_FOCUS,
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-stroke bg-surface-0 px-4 py-3">
          <p className="text-[14px] text-muted">
            {filteredTotal === 0 ? "No rows" : `Showing ${from} to ${to} of ${filteredTotal}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14px] text-stroke">Rows per page</span>
            <Select
              aria-label="Rows per page"
              className="w-24"
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
              options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
            />
            <IconButton
              aria-label="Previous page"
              size="sm"
              variant="secondary"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            </IconButton>
            <span className="text-[14px] text-stroke" aria-live="polite">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <IconButton
              aria-label="Next page"
              size="sm"
              variant="secondary"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            </IconButton>
          </div>
        </div>
      </div>

      {showBar && (
        <BulkBar
          count={selectedCount}
          actions={barActions}
          onClear={clearSelection}
          onAction={(action) =>
            action.onAction(
              selectedRows.map((row) => row.original),
              clearSelection,
            )
          }
        />
      )}
    </div>
  );
}
