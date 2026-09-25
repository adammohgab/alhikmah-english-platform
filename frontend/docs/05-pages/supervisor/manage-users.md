# Page: Manage Users (`/app/supervisor/users`)

The only account-provisioning surface in v1 — there is no public self-signup
(`auth-and-roles.md`).

## Layout

- Filter row: role `Select` (Student/Teacher/Supervisor), class `Select`, search
  `Input` (leading magnifier icon per `forms-and-inputs.md`'s icon-slot pattern).
- `Table`: name, email, role `Badge`, class (students), status (active/disabled),
  row-selection checkboxes for bulk actions (e.g. bulk-assign class), `ghost`
  edit/disable row actions.
- "Add user" primary button → `Modal size="md"` form: name, email, role `Select`,
  class assignment (students/teachers), triggers a Supabase-provisioned account
  (school-issued, no self-signup path per `routing.md`'s auth flow).
- Disabling/removing a user is a `destructive`-variant action behind a
  `ConfirmDialog` stating the specific consequence (e.g. "Disable this account? They
  will lose access immediately. Their past results and submissions are kept.").
