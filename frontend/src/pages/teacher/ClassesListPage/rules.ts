import type { SelectOption, SelectOptionGroup } from "@/shared/components/ui/Select";
import type { TermRow } from "./api";

/* Pure rules for the classes page: grade list, form validation and term grouping. */

export const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));

export const gradeLabel = (grade: string) => `Grade ${grade}`;

export interface CreateClassValues {
  name: string;
  grade: string;
  termId: string;
  description: string;
}

export type CreateClassErrors = Partial<Record<keyof CreateClassValues, string>>;

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 300;

export function validateCreateClass(values: CreateClassValues): CreateClassErrors {
  const errors: CreateClassErrors = {};
  const name = values.name.trim();
  if (name.length < 2) errors.name = "Enter a class name of at least 2 characters.";
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`;
  if (!GRADES.includes(values.grade)) errors.grade = "Choose a grade from 1 to 12.";
  if (!values.termId) errors.termId = "Choose an academic term.";
  if (values.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }
  return errors;
}

/** Terms grouped under their school year, the active year first. */
export function groupTerms(terms: readonly TermRow[]): SelectOptionGroup[] {
  const groups = new Map<string, { label: string; active: boolean; options: SelectOption[] }>();
  for (const term of terms) {
    const group = groups.get(term.year_id) ?? {
      label: term.school_years?.name ?? "School year",
      active: term.school_years?.is_active === true,
      options: [],
    };
    group.options.push({ value: term.id, label: term.name });
    groups.set(term.year_id, group);
  }
  return [...groups.values()]
    .sort((a, b) => Number(b.active) - Number(a.active))
    .map((group) => ({
      label: group.active ? `${group.label} (current)` : group.label,
      options: group.options,
    }));
}

export const yearIdForTerm = (terms: readonly TermRow[], termId: string): string | undefined =>
  terms.find((term) => term.id === termId)?.year_id;

const enc = encodeURIComponent;

export const classLinks = (id: string) => ({
  open: `/teacher/classes/${enc(id)}`,
  roster: `/teacher/classes/${enc(id)}/students`,
  rules: `/teacher/classes/${enc(id)}/rules`,
  curriculum: `/teacher/courses?class=${enc(id)}`,
});
