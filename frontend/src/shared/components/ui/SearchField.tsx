import { forwardRef } from "react";
import type { KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input, type InputProps } from "./Input";

/* ========================================
   Arcade SearchField (GLOBAL-STYLES-SPEC §10 "Input"; TASKS UIK-09)

   An Input preset for search: a Lucide search icon in the left slot and an instant clear (X)
   button that appears as soon as there is text. It is a native `type="search"` field, so it is
   announced as a search box; the browser's own cancel button is hidden in favor of ours.
     Escape  empties the field (and does not bubble, so a parent dialog stays open)
     Enter   calls `onSearch(value)` (ignored while an IME composition is in progress)
   Everything else (label, helperText, error, size, `pill`, ref forwarding, controlled or
   uncontrolled use) is inherited from Input. Use `pill` for the top-bar global search.
   ======================================== */

export interface SearchFieldProps extends Omit<
  InputProps,
  "leftIcon" | "rightIcon" | "clearable" | "type" | "clearOnEscape" | "showCount"
> {
  /** Called with the current text when the user presses Enter. */
  onSearch?: ((value: string) => void) | undefined;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    onSearch,
    onKeyDown,
    clearLabel = "Clear search",
    placeholder = "Search",
    label,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || onSearch === undefined) return;
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      onSearch(event.currentTarget.value);
    }
  };

  return (
    <Input
      autoComplete="off"
      enterKeyHint="search"
      {...rest}
      ref={ref}
      type="search"
      label={label}
      // A search box without a visible label still needs an accessible name.
      aria-label={ariaLabel ?? (label === undefined ? "Search" : undefined)}
      placeholder={placeholder}
      leftIcon={<Search />}
      clearable
      clearOnEscape
      clearLabel={clearLabel}
      onKeyDown={handleKeyDown}
    />
  );
});
