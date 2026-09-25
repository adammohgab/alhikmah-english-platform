# Page: Login (`/login`)

Shared by all three roles — one screen, role is resolved from the account after
login, not chosen by the user.

## Layout

Split screen on desktop (≥1024px), single column on mobile:

- **Start side (60%):** `brand-navy-900` background, school crest (large, ~120px)
  centered-ish in upper third, `display`-scale serif headline in white ("Al Hikmah
  English Learning Platform"), one supporting `body-lg` line in `ink-300`-
  equivalent light tone ("For students, teachers, and supervisors."). No stock
  photography, no illustration — the crest and typography carry the screen, per
  `iconography-and-imagery.md`.
- **End side (40%, or full width on mobile):** `surface-0` background, centered
  login form, max-width ~360px:
  - "Sign in" `h2`
  - Email `Input`
  - Password `Input` (with show/hide toggle icon)
  - "Forgot password?" link (`body-sm`, `brand-navy-500`), end-aligned under the
    password field
  - "Sign in" `Button variant="primary"`, full width
  - Small footer text: "Accounts are provided by your school. Contact your
    supervisor if you need access." (`body-sm`, `ink-500`) — since there's no
    public self-signup.

## States

- Validation errors inline per `forms-and-inputs.md` (invalid email format, empty
  password).
- Auth failure: a `Banner`-style inline error above the form ("Incorrect email or
  password.") — not a toast, since the user's attention is already on this form.
- Loading: primary button shows inline spinner, disabled, label unchanged.
- Already-authenticated users hitting `/login` are redirected straight to their
  role's default page.

## Forgot password flow

Separate lightweight screen/step (same split layout): email input → "Send reset
link" → confirmation state ("Check your email for a reset link.") reusing the same
form panel, not a full navigation to a new route if avoidable (can be a local view
state within the login feature).
