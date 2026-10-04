# SHARED AND PUBLIC SIDE: FULL DESIGN SPEC (v1 DRAFT)

Status: DRAFT v1. Built from the planning conversation. Nothing is final until the Open Questions section at the bottom is resolved.
Companion files: 03-student/STUDENT-SPEC.md (design system in its section 2), 04-teacher/TEACHER-SPEC.md, 05-admin/ADMIN-SPEC.md.
Scope: everything a person sees BEFORE or OUTSIDE their role dashboard: the public landing page, sign-in and password screens, help/FAQ/about/legal pages, error and maintenance pages, and the cross-role rules (route guards, redirects, sessions) that all three dashboards depend on.
Rule for this file: pure text. No images. A developer should be able to build any page from this file alone.

Page IDs (SH-xx) are stable. The task-breakdown step will reference them. Do not renumber after approval.

---

## 1. CONTEXT AND LOCKED DECISIONS

Locked decisions (from the owner):
- The original task files only define two shared pages: the Landing page (hero, platform overview, learning areas, AI, games, curriculum, login CTA) and the Login page (credential fields, login action, forgot-password link, loading state, error state). This spec keeps both and adds the pages the other specs already depend on.
- The landing page is for students and the school community, with a calm, informative tone. It is NOT a heavy marketing page.
- Landing visuals: art in the hero, product previews lower down.
- One sign-in form for everyone. The account decides which dashboard opens (student, teacher, admin).
- People sign in with a USERNAME and password. Usernames and initial passwords are assigned by the school. There is no self-registration.
- Forgot password has two parts on one page: a request form and the contact information. There are no emails anywhere. Reset requests go to the Admin (see section 8).
- Extra public pages wanted: Help / Contact the school, FAQ, Terms and Privacy, About the platform.
- The platform uses its own visual identity (design system in the student spec section 2). It does NOT follow the school logo colors. The school logo is shown UNCHANGED wherever it appears.
- English only. Frontend only: UI plus mock data. UI only for authentication (no real sessions).

Old instruction superseded: the original tasks say "Follow the approved Al Hikmah visual identity." This is replaced by the new design system. The rule "Keep the original school logo unchanged" still applies.

---

## 2. DESIGN SYSTEM DELTAS FOR PUBLIC PAGES

Tokens, typography (Bricolage Grotesque headings, Figtree body), spacing, radius scale, status colors and UI copy rules are the same as the student spec. Differences:

- Theme: public pages always use the free Daylight theme tokens. They ignore any purchased theme and any dark preference (assumption, see section 10).
- Expression: public pages may be more expressive than the app: larger display type (up to 64 px and larger on desktop), generous spacing, and illustrated/abstract art.
- Layout rhythm: sections must NOT all share one structure. Vary the layout from section to section (a cropped preview bleeding off one edge, an asymmetric split, a full-width band, a sequence diagram). Avoid a row of three identical feature cards, identical card styling everywhere, or one repeated fade-up entrance. The landing page should not read as a SaaS template.
- Art: original abstract compositions built from the token colors (primary, spark, mint, sun, sky) with letterforms, speech-bubble and book-page motifs. No stock photography. No gradient washes used as decoration.
- Motion: one orchestrated entrance in the hero only, plus small purposeful motion (button press, accordion open). Everything respects reduced-motion preferences (fall back to no animation).
- School logo rule: never recolor, stretch, crop, rotate, outline, or place on a busy background. Use it on a plain light surface (paper or surface token) with clear space of at least half the logo height on every side. On any dark or colored background place it on a neutral light plate.
- Product previews on the landing page are static mock screens built from the real app components and mock data, non-interactive, hidden from screen readers (aria-hidden) and accompanied by a visible caption that explains what the preview shows.
- Content width: marketing sections up to 1200 px; reading pages (FAQ, legal, about) up to 720 px.

---

## 3. SITEMAP (ROUTES AND PAGE IDS)

```
SH-00  Shared shell parts (public header, footer, auth card, error template)
SH-01  /                       Landing page
SH-02  /login                  Sign in
SH-03  /forgot-password        Forgot password (request form + contact info)
SH-04  /set-password           Set a new password (first sign-in and after an admin reset)
SH-05  /account-inactive       Account not active
SH-06  /help                   Help and contact the school
SH-07  /faq                    FAQ
SH-08  /legal                  Terms and Privacy (two tabs)
SH-09  /about                  About the platform
SH-10  (not found)             404 page
SH-11  (server error)          Something went wrong page
SH-12  /offline                Offline page
SH-13  /maintenance            Maintenance page
SH-14  (forbidden)             No access page (wrong role)
```

Cross-role rules (not pages): route guards and redirects (section 6), sessions and timeouts (section 7), password reset request flow (section 8).

---

## 4. SHARED COMPONENTS (SH-00)

PublicHeader: sticky top bar, 64 px. Left: the platform wordmark (placeholder). Center (desktop): anchor links on the landing page (Overview, Learning areas, AI, Games, Curriculum) and page links elsewhere (About, FAQ, Help). Right: "Sign in" button (primary). Mobile: wordmark and a menu button that opens a full-screen menu with the same links and a large Sign in button. When the person is already signed in, the button becomes "Open my dashboard."
PublicFooter: the school logo (unchanged, on a light surface) with the school name, links (About, Help, FAQ, Terms and Privacy), "Sign in," and a small line "Accounts are created by your school." Copyright line.
AuthCard: a centered card (max width 440 px, radius 24) used by sign-in, forgot password, set password and account not active. Contains the logo mark at the top, title, body, and a footer row with a help link.
PasswordField: a text input with show/hide toggle (a button with an accessible label), caps-lock warning, optional strength meter and rules checklist (used on set password).
FormField: label above, helper text below, error text below with an icon, error text linked to the input via aria-describedby.
InlineAlert: an alert box (info, warning, error, success) used for form-level messages, announced to screen readers (role "alert" for errors, "status" for info).
ErrorPageTemplate: centered layout with a motif, a short title, one sentence of explanation, and up to two buttons.
ContactCard: a card showing the school contact details from Platform settings (school name, office hours, phone, location, contact email shown as plain text, support link). Used on Help, Forgot password and Account not active.
DocumentTitle rule: every page sets a unique title in the form "Page name | Platform name."

---

## 5. PAGE SPECS

Format: Purpose, Layout (desktop then mobile), Sections or fields, Actions, States, Links in and out.

---

### SH-01 Landing page

Purpose: introduce the platform plainly to students and the school community, and get them to sign in. Informative and calm.

Layout desktop: full-width sections stacked, content up to 1200 px. Public header on top, footer at the bottom.

Sections in order:
1. Hero. Left: a headline of one short line, a one-sentence subline, a primary button "Sign in" and a secondary text link "See how it works" (scrolls to the overview). Right: the hero art (abstract composition described in section 2) that fills the right half and bleeds slightly past the content edge. Under the buttons, one quiet line: "For students and teachers of {school name}." Copy proposals (not final): headline "Practice English every day." subline "Lessons, quizzes, games and an AI tutor in one place. Level up as you learn." The hero entrance is the only orchestrated animation on the page.
2. Platform overview. A short intro line, then three plain statements in a staggered (not equal-card) layout: Learn (courses, units and lessons), Practice (vocabulary, grammar, reading, writing, translation, games) and Grow (XP, levels, streaks, badges and rewards). Beside them, a large product preview of the student dashboard cropped off the right edge, with a caption ("Your day at a glance: quests, streak and deadlines").
3. Learning areas. The five skills plus translation shown as a horizontal row of tiles with distinct sizes: Vocabulary, Grammar, Reading, Writing, Listening, Translation. Each tile has the skill color, an icon, one line of text, and a tiny preview of its screen. Tapping a tile on mobile expands it.
4. AI. A two-column section: left a short text on what the AI Tutor does (explains lessons, corrects writing, quizzes you, answers questions about English) and a plain note "Your teacher stays in charge of your grades." Right: a product preview of the chat with a sample exchange (mock text). A short line about limits: "The tutor only helps with English and study questions."
5. Games. A full-width band with a different background tone: a preview strip of the game tiles (Vocabulary Match, Word Builder, Grammar Challenge, Reading Challenge, Sentence Builder, Spelling, Timed Quiz) and a line "Solo games. Beat the clock or your own best score."
6. Curriculum. Left: a simple timeline for grades 7 to 12 with the three tracks (Main Course, Reading Club, Exam Prep) as stripes. Right: the course structure as a true sequence diagram: Course, Unit, Lesson, Activity, Quiz (numbered steps are appropriate here). A caption states that quizzes unlock after the lessons.
7. For teachers (addition, small). A compact strip with three plain lines: AI helps plan lessons and build quizzes, AI drafts feedback and the teacher approves, class progress at a glance. No preview image.
8. Login call to action. A full-width band: "Ready to continue?" with the line "Sign in with the username your school gave you." and a large "Sign in" button, plus a quiet link "Need help signing in?" (to SH-06).
9. Footer (PublicFooter).

Mobile layout: single column; the hero art sits under the text and is cropped to a short height; previews are shown at a smaller size; the timeline becomes a vertical list.
Interactions: anchor links scroll smoothly (instant under reduced motion). The header shows the active section while scrolling (small underline).
States: none beyond the signed-in variant (header button "Open my dashboard"). The page has no forms.
Performance and accessibility: art as inline SVG or CSS shapes, lazily loaded previews, descriptive captions, a skip-to-content link, one h1 (the hero headline), headings in order.

---

### SH-02 Sign in

Purpose: let any user sign in with one form.
Layout desktop: a split screen. Left (about 55 percent): an art panel using the hero art style with the platform wordmark and one short line ("Welcome back."). Right: the AuthCard centered. Mobile: the AuthCard on a plain background with a short art band at the top.
Card contents, in order:
1. School logo (unchanged) and the platform wordmark.
2. Title "Sign in" and the line "Use the username and password from your school."
3. Form-level InlineAlert area (hidden until needed; announced to screen readers).
4. Username field (autocomplete "username", no auto-capitalization, trimmed). Password field (PasswordField with show/hide, caps-lock warning, autocomplete "current-password").
5. Checkbox "Keep me signed in on this device" (off by default).
6. Primary button "Sign in" (full width). Link "Forgot your password?" (to SH-03). Link "Need help?" (to SH-06).
7. A quiet line: "Accounts are created by your school."
8. (Development only, hidden in production builds) a collapsed panel "Demo accounts" listing mock usernames and passwords for a student, a teacher, a School admin and a Super admin, with buttons that fill the form.
Behavior:
- Validation: both fields required; messages on blur and on submit ("Enter your username." / "Enter your password.").
- Pressing Enter submits. While submitting: the button shows a spinner and the text "Signing in", fields are disabled.
- Success: redirect per section 6.
States and messages (shown in the InlineAlert):
- Invalid credentials: "Username or password is incorrect." (the same message for an unknown username and a wrong password).
- Locked: "Too many attempts. Try again in {minutes} minutes, or ask your school to unlock your account."
- Network error: "We could not reach the server. Check your connection and try again."
- Session expired (arrived from an expired session): info alert "You were signed out for security. Sign in again to continue."
- Signed out (arrived after sign-out): info alert "You have signed out."
- Maintenance mode on: a warning alert at the top "The platform is under maintenance. {message}" and the Sign in button is disabled for students and teachers. Admins can still sign in; an "I am an admin" toggle is NOT used. Instead the button stays enabled and the server decides by role (mock: usernames starting with "admin" bypass).
- Already signed in: skip the page and redirect to the person's dashboard.
Mock behavior in this phase: the form checks the mock accounts; any other combination shows the invalid-credentials message; after 5 wrong attempts the form shows the locked message for the mock duration.
Links: SH-03, SH-06, SH-01 (logo), role dashboards.

---

### SH-03 Forgot password (request form and contact info)

Purpose: help people who cannot sign in, without email.
Layout desktop: inside the same split layout as SH-02 (art panel left), the right side shows a wider card with two parts side by side (stacked on mobile): "Request a reset" and "Contact your school."
Part 1, Request a reset (form):
- Intro line: "Tell us who you are. Your school will give you a temporary password."
- Fields: Username (required), Full name (required), Grade and class (optional, for students), Note (optional, up to 200 characters).
- Button "Send request."
- Success state replaces the form: "Request sent. Your school will contact you with a temporary password. This can take up to 2 school days." (The text is the same whether or not the username exists, so no one can discover which usernames are real.) A "Back to sign in" button.
- Limits: at most 3 requests per hour from one device. When exceeded: "You have sent several requests. Please wait before trying again, or contact your school."
Part 2, Contact your school: the ContactCard (office, hours, phone, location, contact email as plain text) plus short guidance: "Students: ask your teacher. Teachers: ask your school admin."
Where the request goes: it appears for the Admin in the Users page "Reset requests" tab and as an admin notification (section 8).
Links: SH-02, SH-06.

---

### SH-04 Set a new password

Purpose: force a new personal password after the first sign-in with a temporary password, and after an admin reset.
Access: only reachable when the signed-in account has the "must change password" flag. All other routes redirect here until completed.
Layout: AuthCard centered on a plain background with no header navigation (only "Sign out").
Contents: title "Set a new password"; line "Your school gave you a temporary password. Choose your own to continue."; fields: New password (PasswordField with strength meter), Confirm new password; a live rules checklist (from Platform settings Security: minimum length, upper and lower case, number, symbol if required, not equal to the username or the temporary password); primary button "Set password and continue"; "Sign out" link.
Validation: rules must all pass; confirmation must match; show inline errors.
Success: a brief confirmation, then redirect to the person's dashboard (section 6). All other sessions of this account are signed out.
Failure: "We could not save your password. Try again." with a retry.

---

### SH-05 Account not active

Purpose: tell archived or disabled users clearly what to do.
Layout: AuthCard.
Contents: title "This account is not active"; text "Your account has been archived or turned off. Ask your school if you think this is a mistake."; ContactCard; button "Back to sign in."
Shown when a sign-in succeeds on an account with status Archived or when a signed-in user is archived mid-session (they are signed out and redirected here).

---

### SH-06 Help and contact the school

Purpose: one place for help that does not need an account.
Layout: reading layout (720 px) with a sidebar table of contents on desktop.
Sections in order:
1. Contact: the ContactCard (school name, office hours, phone, location, contact email as plain text, support link).
2. Who should I ask? A simple two-column list: Students: your teacher first, then the school office. Teachers: your school admin. Admins: the platform owner.
3. Common problems: short entries with links: I cannot sign in (checklist: check username spelling, caps lock, ask the school to unlock), I forgot my password (link to SH-03), My account is not active (SH-05), I cannot see my class or course (ask your teacher), The AI Tutor is not answering (it may be off or you may have reached today's limit), I want to report a problem (sign in, then use "Report a problem" next to the item).
4. Browser and device tips: supported browsers (latest Chrome, Edge, Safari, Firefox), screen sizes, and "Works on phones."
Mobile: single column; the table of contents becomes a dropdown.

---

### SH-07 FAQ

Purpose: answer common questions without a login.
Layout: reading layout (720 px). A search field at the top that filters questions live. Groups below, each an accordion list (one question open at a time within a group; all open state is allowed with "Expand all").
Groups and starter questions:
- Getting started: How do I get an account? How do I sign in? What if I forget my password?
- Learning: What are XP, levels and streaks? How do courses, units and lessons work? Why is a quiz locked?
- Quizzes and assignments: What is the difference between a quiz and an assignment? Can I retake a quiz? Who grades my writing?
- Rewards and shop: What are coins and how do I earn them? What can I buy? What are themes?
- AI Tutor: What can the AI Tutor do? Why did it refuse my question? Is there a limit?
- Privacy: Who can see my progress? What do other students see on the leaderboard? Can school staff read my AI chats? (Answer plainly: yes, authorized school staff can view conversations when needed, and every view is logged.)
- Troubleshooting: The page will not load. My work did not save.
Content is static in this phase (assumption: not editable by the Admin). Each answer is short, plain, and links to the relevant page when helpful.
Empty search: "No questions match. Try different words, or contact your school" with a link to SH-06.

---

### SH-08 Terms and Privacy

Purpose: the legal pages.
Layout: reading layout with two tabs: Terms of use, Privacy notice. A table of contents on the left on desktop. "Last updated" date at the top. A Print button.
Content: the school supplies the final legal text. The placeholder structure must exist:
- Terms of use: who may use the platform; account responsibility (keep your password private, accounts are assigned by the school); acceptable use; AI features and their limits (the AI can make mistakes, teachers stay responsible for grading); rewards and the in-app currency (no real-money value, no refunds); content ownership; account suspension; changes to the terms; contact.
- Privacy notice: what data is collected (name, username, grade, class, learning progress, quiz and assignment results, writing submitted, rewards and purchases, leaderboard display name, AI conversations); why; who can see it (the student, their teachers, school admins; other students see only display name, avatar, level and XP on leaderboards); AI conversations may be reviewed by authorized school staff and each review is logged; how long data is kept (from Platform settings Data retention); the rights of students and guardians and how to ask the school; security measures at a high level; contact.
Both documents need review by the school before launch (see section 10).

---

### SH-09 About the platform

Purpose: explain what the platform is in plain language.
Layout: reading layout.
Sections: What this is (two or three sentences); Who it is for (students, teachers, the school); How learning works (the course structure sequence: Course, Unit, Lesson, Activity, Quiz, with the note that quizzes unlock after the lessons); How AI is used (the Tutor helps students learn, teachers use AI to prepare and draft, teachers approve what students receive and grades, the school controls AI features and limits); Rewards (XP, levels, streaks, badges, coins and themes are for motivation only); Privacy in brief (link to SH-08); Contact (link to SH-06). The school logo (unchanged) with a line about the school.

---

### SH-10 Not found (404)

Layout: ErrorPageTemplate. Title "We could not find that page." Text "The link may be wrong or the page may have moved." Buttons: "Go back" (secondary) and "Go to my dashboard" (primary, if signed in) or "Go to the home page" (if not).

### SH-11 Something went wrong

Layout: ErrorPageTemplate. Title "Something went wrong." Text "It is on our side. Your work is not lost if it was saved." Buttons: "Try again" (reload) and "Go to my dashboard / home." A small "Error ID" line with a copyable mock code and the text "Share this with your school if the problem continues."

### SH-12 Offline

Layout: ErrorPageTemplate and also an in-app banner pattern. Title "You are offline." Text "Check your connection. Work in progress is saved on this device and will sync when you are back." A "Try again" button. Inside the app, a slim banner at the top "Offline. Changes will sync when you reconnect." appears and disappears automatically with the connection state; autosave states show "Saved on this device."

### SH-13 Maintenance

Layout: ErrorPageTemplate on a calm background with a motif. Title "We are doing maintenance." The message set by the Admin in Platform settings, the expected return time if provided, and the ContactCard. A "Check again" button. Admin accounts bypass this page (they see a banner in the admin app instead).

### SH-14 No access

Layout: ErrorPageTemplate. Title "This page is not available for your account." Text names the area ("This page is for teachers.") without revealing details. Button "Go to my dashboard." Shown when a signed-in user opens another role's route.

---

## 6. ROUTE GUARDS AND REDIRECTS (all roles)

Roles: student, teacher, admin (School admin or Super admin). One role per account (assumption).

Rules in order of evaluation on every navigation:
1. Maintenance mode on and the user is a student or teacher: show SH-13 (the sign-in page shows the maintenance alert).
2. Not signed in and the route is private: redirect to SH-02 with a "next" value (only for paths inside their future role area).
3. Account Archived: sign out and show SH-05.
4. Must change password: redirect to SH-04 for every route except SH-04, sign out, and public pages.
5. Route belongs to another role: show SH-14.
6. Role-specific permission missing (for example a School admin opening Platform settings): show SH-14 with the line "Only a Super admin can open this page."

Where each role lands after sign-in (unless "next" is valid): student to /student, teacher to /teacher, admin to /admin.
The "next" value is accepted only when the target belongs to the signed-in role area; otherwise ignored.
Public pages while signed in: the landing page, FAQ, About, Help and Legal remain viewable, with the header button "Open my dashboard." SH-02 and SH-03 redirect signed-in users to their dashboard.
Sign out: confirms with a toast "Signed out", clears the mock session, and goes to SH-02 with the signed-out alert.

---

## 7. SESSIONS AND SECURITY BEHAVIOR (UI level)

- Session length and idle timeout come from Platform settings Security. Defaults (placeholders): idle timeout 30 minutes; "Keep me signed in" extends to 14 days on that device.
- Two minutes before the idle timeout a dialog appears: "Are you still there? You will be signed out in 2:00." Buttons "Stay signed in" and "Sign out." Dialogs and timers announce to screen readers. When the timeout passes, the user is sent to SH-02 with the session expired alert. Work in progress is saved first (assignments, activities, drafts autosave).
- Focused flows (quiz attempt, assignment solving, game) pause the idle timer while active (an active quiz must not sign the student out mid-attempt).
- After an admin password reset or a password change, all other sessions of that account end.
- Lockout: failed sign-in attempts and lockout duration come from Platform settings Security (default 5 attempts, 15 minutes). An admin can unlock an account in the Users page.
- No sign-in message ever reveals whether a username exists.
- Passwords never appear in URLs or logs. Temporary passwords are shown once to the admin.

---

## 8. PASSWORD RESET REQUEST FLOW (cross-role)

1. A person who cannot sign in submits the form on SH-03.
2. The request appears for admins as: a new row in the Users page under a "Reset requests" tab (username, full name, grade and class, note, time, status New or Handled), a notification "Password reset request from {username}", and a count on the Dashboard "Sign-in problems" panel.
3. An admin verifies the person (outside the platform, in person or through the school) and presses "Generate temporary password." The password is shown once with Copy and Print buttons. The account is marked "must change password." All sessions end.
4. The admin marks the request Handled. The action is written to the audit log.
5. The person signs in with the temporary password and is taken to SH-04.
Rules: the request form never confirms whether the username exists. Admins can dismiss a request ("Not recognized"). Requests older than 14 days are archived automatically.

---

## 9. MOCK DATA ENTITIES (names only)

MockAccount: username, password, role, displayName, mustChangePassword, status (active, archived, locked), lockedUntil.
Session: userId, role, rememberMe, expiresAt, idleAt.
ResetRequest: id, username, fullName, gradeClass, note, createdAt, status (new, handled, dismissed).
SchoolContact: schoolName, officeHours, phone, location, contactEmail, supportLink (from Platform settings General).
PlatformSecuritySettings: passwordRules, lockoutAttempts, lockoutMinutes, idleTimeoutMinutes, rememberMeDays, maintenanceMode, maintenanceMessage, expectedBackAt.
FaqEntry: id, group, question, answer, links.
LegalDocument: kind (terms, privacy), version, updatedAt, sections.

---

## 10. REQUIRED CHANGES TO THE OTHER SPECS (apply once this file is approved)

Admin spec:
1. Add a "Username" field (assigned by the school, unique, auto-suggested from the name) to Create user (AD-04), the CSV import mapping (AD-05), the Users list search and columns (AD-02) and User detail (AD-03). Sign-in uses the username, not the email. Email becomes an optional contact field.
2. Users page (AD-02): add a "Reset requests" tab and an "Unlock account" action for Locked users.
3. Dashboard (AD-01): the "Sign-in problems" panel also shows the count of open reset requests.
4. Notifications (AD-29): add "Password reset request."
5. Platform settings (AD-27): Security settings feed SH-02 and SH-04 (lockout, password rules, timeouts); Maintenance message and expected return time feed SH-13; General contact details feed the ContactCard.
6. Admin invite dialog (AD-28): the sign-in identifier is a username, not an email.
Teacher spec:
1. TC-04 "Invite by student ID or email" becomes "Invite by username or student ID."
2. Roster columns show the username.
Student spec:
1. Settings (ST-31): Account shows the username (read-only) and a "Change password" action.
2. Class invites appear in notifications (already listed in the admin spec section 10).
All specs: use the shared error and no-access pages for guard failures; the idle-timeout dialog and offline banner behave the same everywhere.

---

## 11. OPEN QUESTIONS AND ASSUMPTIONS TO CONFIRM

Assumptions I made (confirm or correct):
1. Public pages always use the Daylight theme (no dark mode, no purchased themes).
2. One role per account (an admin who also teaches would need two accounts).
3. "Keep me signed in on this device" exists and is off by default.
4. The landing page includes a small "For teachers" strip, which was not in the original task list.
5. FAQ and About content are static text in this phase and not editable by the Admin.
6. (Resolved) Teachers can reset the passwords of students in their own classes; Admins reset everyone else's (teachers and students outside any teacher's class). Reset requests from students appear for BOTH the student's teachers (Students page, "Reset requests") and Admins; whoever handles it first marks it Handled. A request older than 14 days is archived. (Pending edits: add a "Reset password" action to Teacher TC-04/TC-08 with the same show-once temporary password dialog and audit entry.)
7. Demo accounts appear only in development builds.
8. No cookie banner is needed unless analytics or tracking are added later.
9. The school supplies the final Terms and Privacy text.

Still open:
- Should the "Help" page include a contact form for people who can already sign in? (It would reach the Admin as an in-app request.)
- The platform name and wordmark are still placeholders.
- The school logo file and its approved clear-space rules.
- Final landing page copy (the proposals above are placeholders).
