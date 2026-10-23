# Bootstrap the first Super Admin

This is a **manual, owner-triggered** GitHub Actions workflow. It uses Supabase's server-side Auth Admin API and the existing `public.profiles` schema. It does not expose a public admin-creation endpoint and does not put credentials in source control.

Workflow: `.github/workflows/bootstrap-super-admin.yml`

## 1. Add repository Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `SUPABASE_URL`: the project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the server-side service-role key for this same Supabase project. Never put it in frontend variables or commit it.
- `SUPERADMIN_PASSWORD`: a strong, unique password of at least 14 characters. Save it in a password manager.

Do not paste secret values into an issue, pull request, chat, workflow input, or source file.

## 2. Run the workflow

After this change is merged into `main`:

1. Open **Actions → Bootstrap Super Admin**.
2. Select **Run workflow** on branch `main`.
3. Enter `CREATE_SUPER_ADMIN` exactly in the confirmation field.
4. Enter a unique username (3–32 characters: lowercase letters, digits, dot, underscore, or hyphen) and display name.
5. Start the workflow and inspect its logs. The password and service-role key are never printed.

The workflow follows the app's existing login convention: the username is converted to an internal Auth address `<username>@accounts.invalid`. It creates the Auth user (or updates the password for that same internal username account), then upserts the matching `public.profiles` row with `role = super_admin`, `status = active`, and `must_change_password = true`. It refuses to add a second Super Admin if another account already has that role.

## 3. Verify and sign in

- Confirm the workflow finishes successfully.
- In Supabase **Authentication → Users**, verify the internal address `<username>@accounts.invalid` exists.
- In **Table Editor → public.profiles**, verify the same Auth UUID has the requested username, `role = super_admin`, and `status = active`.
- Open the production site and sign in with the **username and the password stored in the GitHub Actions secret**.
- The profile is marked `must_change_password = true`; complete the app's password-change flow if available.

If the workflow fails after creating the Auth user, read the error and fix the profile/schema issue before rerunning. Do not disable RLS or expose the service-role key to fix it.

## Security notes

- Only repository maintainers who can run Actions should be allowed to invoke this workflow.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `SUPERADMIN_PASSWORD` as GitHub Actions secrets, not Actions variables.
- Once the account is working, rotate the password if it was shared and consider removing the bootstrap workflow/secrets after saving a secure recovery method.
