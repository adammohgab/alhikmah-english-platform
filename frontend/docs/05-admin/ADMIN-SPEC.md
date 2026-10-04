# ADMIN SIDE: FULL DESIGN SPEC (v1 DRAFT)

Status: DRAFT v1. Built from the planning conversation. Nothing is final until the Open Questions section at the bottom is resolved.
Companion files: 03-student/STUDENT-SPEC.md and 04-teacher/TEACHER-SPEC.md. This file reuses their design system, shared components, AI action card pattern (TEACHER-SPEC 4.10), course/lesson/quiz builders (TEACHER-SPEC TC-10, TC-11, TC-14, TC-17), Question editor (TEACHER-SPEC section 8), and print stylesheet (TEACHER-SPEC section 7). Where this file says "same as teacher", read the teacher spec.
Rule for this file: pure text. No images. A developer should be able to build any page from this file alone.

Page IDs (AD-xx) are stable. The task-breakdown step will reference them. Do not renumber after approval.

---

## 1. ROLE CONTEXT AND LOCKED DECISIONS

Who the Admin is: school staff who run the platform. They manage people, classes, the official curriculum and content, the rules of the reward system, AI behavior and cost, and the health of the platform.

Locked decisions (from the owner):
- Two admin roles: Super admin (everything) and School admin (limited to users, classes, and content; no platform settings).
- User management actions: create one user manually, bulk import from CSV, reset passwords, deactivate/archive users (history is kept), and bulk promote students to the next grade (year rollover).
- Both teachers and Admins can create classes. Admins can add or remove teachers on any class, and only Admins can delete a class.
- Gamification is managed by the Admin: XP values and the level curve, quest and badge definitions, shop items with prices and rarity, creating and publishing themes, avatar items/frames/titles, and leaderboard moderation (hide and reset entries).
- The Admin has full AI controls: turn each AI feature on/off, usage limits per student and per teacher, a usage and cost dashboard, a school-wide AI activity log, content safety rules (blocked topics, tone, age-appropriate filter), and custom instructions for the AI (school policy, curriculum standards).
- The Admin can use AI to generate the official curriculum.
- Teachers can publish courses to the school library without approval; the Admin can unpublish them afterward (moderation).
- Admin dashboard priorities: (1) pending issues (flagged content, reported items, failed AI jobs), (2) users and activity overview, (3) AI usage and cost, (4) platform status (features on/off, errors).
- Original task files for Admin: dashboard, users management, curriculum management (Grade, Term, Unit, Lesson, Activity, Assessment), content management (create, edit, draft, published, preview, unpublish), platform settings (general, language, notifications, feature settings, platform preferences).
- AI safety for sensitive topics: when a student writes about self-harm, abuse or serious distress to the AI Tutor, the Tutor answers with a short neutral message ("We can't process this request.") and does not continue that topic. There are NO alerts to staff and no designated recipients. The blocked exchange is logged as a Low severity item in the moderation queue like any other safety-rule block.
- Admins can read any student AI conversation, but a reason is required and every view is logged.
- The platform sends NO emails. Everything is in-app. Credentials (temporary passwords) are handed out by the school.
- Interface is English only. Frontend only: UI plus mock data. No real backend and no real AI calls.

---

## 2. DESIGN SYSTEM DELTAS FROM THE TEACHER SIDE

Tokens, typography, spacing, radius scale, status colors, table patterns, chart rules and form rules are the same as the teacher spec. Differences:

- Tone: sober and precise. This is a control room. No celebration, no streak flames, no coins in the chrome.
- Density: same as teacher with Compact option. Default table row 48px.
- Theme: Admins choose Daylight or Nightfall only.
- Role badge: the top bar always shows the admin's role ("Super admin" or "School admin") as a small chip next to the avatar.
- Permission-aware UI: sections the role cannot change are shown read-only with a lock icon and the line "Only a Super admin can change this." Sections the role cannot see at all are hidden from the sidebar.
- Danger zone pattern: destructive or school-wide actions (year rollover, delete class, reset a leaderboard, disable a feature, archive many users, publish rule changes) use a dedicated dialog with: a plain statement of what will happen, an IMPACT PREVIEW (exact counts and examples), and for the most severe actions a typed confirmation (the admin types a keyword such as ROLLOVER). Buttons name the action ("Promote 412 students"), never just "Confirm."
- Draft, Publish, Versions pattern (used for XP rules, curriculum, quests/badges, shop items, themes, AI instructions, safety rules): every configurable set has Draft and Published versions, an "Effective from" option (now or a date), a version history with who changed what, a diff view (before and after), and "Restore this version." Editing happens on the draft; nothing changes for users until Publish.
- Impact preview: before publishing a rule change, show how many users are affected and a simple example ("Level 12 will need 40 more XP. 38 students will move down one level" or "No students change level").
- Audit: every admin action writes an audit entry (AD-26) with before/after values.
- Test sandboxes: where behavior is complex (AI safety rules, AI instructions, quest rotation, badge criteria), a "Test it" panel lets the admin simulate an input and see the result using mock data.

---

## 3. PERMISSIONS (WHO CAN DO WHAT)

Super admin: everything.
School admin: users, classes, curriculum, content, moderation, announcements, reports. Read-only on gamification rules, AI controls and usage. No access to platform settings or to admin accounts.

| Area | Super admin | School admin |
|---|---|---|
| Dashboard | Full | Full (AI cost shown read-only) |
| Users (students, teachers) | Full | Full |
| Admin accounts and roles | Full | Hidden |
| Classes | Full | Full |
| Year rollover | Full | Full (typed confirmation required) |
| Curriculum | Full | Full |
| Content management | Full | Full |
| Moderation | Full | Full |
| Gamification (XP, quests, badges, shop, avatar, themes) | Full | View only |
| Leaderboard moderation | Full | Full |
| AI features, limits, safety rules, instructions | Full | View only |
| AI usage and cost | Full | View only |
| AI activity log | Full | View (limited detail) |
| Announcements | Full | Full |
| Reports | Full | Full |
| Audit log | Full | Own scope only (users, classes, content) |
| Platform settings | Full | Hidden |

(Assumption: the "View only" rows for School admin and the rollover rule need confirmation, see section 11.)

---

## 4. GLOBAL SHELL (AD-00)

### 4.1 Desktop (1200+)
Left sidebar 264px (collapsible to a 72px icon rail). Top bar 64px. Content max width 1440px, 32px padding.

Sidebar, top to bottom:
1. Platform wordmark (placeholder). School logo small at the bottom, unchanged.
2. Dashboard.
3. People: Users, Classes.
4. Learning: Curriculum, Content, Moderation (with a count badge of open items).
5. Engagement: XP and rules, Quests and badges, Shop catalog, Avatar studio, Themes studio, Leaderboard.
6. AI: Features and limits, Safety and instructions, Usage and cost, Activity log.
7. Communicate: Announcements.
8. Insights: Reports, Audit log.
9. System (Super admin only): Platform settings, Admins and roles.
10. Bottom: Notifications, and the admin's name, role chip and menu (Sign out).
Items that are read-only for the current role show a small lock icon.

Top bar: page title or breadcrumb; global search (users, classes, content, settings); an "Ask AI" button for the Admin Copilot (same component as the teacher Copilot, admin-scoped; Ctrl/Cmd+J); notification bell; role chip; avatar menu.

### 4.2 Tablet and mobile
Tablet: icon rail by default, overlay expand. Mobile: admin is supported for monitoring and urgent actions only. Bottom tab bar: Home, Users, Moderation, AI, More. Tables become stacked cards. Builders, wizards with large tables (CSV import mapping, rollover) show "Best on a larger screen" but remain usable.

### 4.3 Global behaviors
- Toasts for confirmations; destructive actions use the danger zone pattern.
- Search is global ("/" focuses it).
- Every list has loading, empty and error states as defined in the student spec.
- A maintenance mode banner appears at the top for admins when enabled in settings.

---

## 5. SITEMAP (ROUTES AND PAGE IDS)

```
AD-00  Shell (all pages)
AD-01  /admin                               Dashboard
AD-02  /admin/users                         Users list
AD-03  /admin/users/[userId]                User detail (view, edit, reset password, archive)
AD-04  /admin/users/new                     Create user
AD-05  /admin/users/import                  CSV import wizard
AD-06  /admin/users/rollover                Year rollover (bulk promote)
AD-07  /admin/classes                       Classes list (create)
AD-08  /admin/classes/[classId]             Class detail (teachers, students, courses, delete)
AD-09  /admin/curriculum                    Curriculum management (Grade, Term, Unit, Lesson, Activity, Assessment)
AD-10  /admin/curriculum/generate           Generate official curriculum (AI wizard)
AD-11  /admin/content                       Content management (library)
AD-12  /admin/content/[contentId]           Content editor and preview
AD-13  /admin/moderation                    Moderation queue (flagged, reported, failed AI jobs)
AD-14  /admin/engagement/xp                 XP, levels, coins and streak rules
AD-15  /admin/engagement/quests-badges      Quest templates and badge definitions
AD-16  /admin/engagement/shop               Shop catalog (items, prices, rarity)
AD-17  /admin/engagement/avatar             Avatar studio (items, frames, titles)
AD-18  /admin/engagement/themes             Themes studio
AD-19  /admin/engagement/leaderboard        Leaderboard moderation
AD-20  /admin/ai/features                   AI features and limits
AD-21  /admin/ai/safety                     AI safety rules and custom instructions
AD-22  /admin/ai/usage                      AI usage and cost
AD-23  /admin/ai/log                        AI activity log
AD-24  /admin/announcements                 School-wide announcements
AD-25  /admin/reports                       Reports
AD-26  /admin/audit                         Audit log
AD-27  /admin/settings                      Platform settings (Super admin only)
AD-28  /admin/settings/admins               Admins and roles (Super admin only)
AD-29  /admin/notifications                 Admin notifications
```

---

## 6. PAGE SPECS

Format: Purpose, Layout, Sections in order, Data, Actions, States, Permissions, Links.
Generic states unless overridden: Loading = skeletons shaped like final content. Empty = one sentence plus one action. Error = what failed plus "Try again."

---

### AD-01 Dashboard

Purpose: show what needs the admin's attention and the state of the platform.
Layout desktop: 12-column grid. Full-width pending issues band on top, then a two-column body.

Sections in order:
1. Greeting and summary line ("4 issues need attention. AI spend is at 68 percent of the monthly budget.").
2. Pending issues (highest priority, full width). A panel with a count per type shown as tabs or chips: Flagged content, Reported items, Failed AI jobs (with total). Below, a table of the newest 6 items: type chip, short description, source (user, class or feature), severity (Low, Medium, High), age (and an overdue chip when High is older than 24 hours), status, and an "Open" action. "Open moderation queue" link. If no issues: "No open issues." with a calm check state.
3. Users and activity (left, second). Tiles: students, teachers, admins, active today, active this week, new this week. A 14-day line chart of daily active users split by role (student, teacher). A small list "Sign-in problems" (locked accounts, repeated failed logins) with a link to the user.
4. AI usage and cost (right, third). Month-to-date spend versus budget as a bar with threshold markers at 70, 90 and 100 percent; forecast for the month; requests today; usage by feature (top 5 as horizontal bars); limit hits today (students and teachers). Link "Open AI usage." A warning chip when forecast exceeds budget.
5. Platform status (fourth). A list of feature switches with their state as chips (AI Tutor, AI grading, Copilot, Course generation, Games, Shop, Leaderboard, Translation, Certificates, Announcements) showing On, Off or Limited (for example "On for grades 9 to 12"), plus system health (mock): error rate in the last 24 hours, failed jobs, API latency, last data backup time, and maintenance mode state. A "Manage features" link (Super admin) or read-only lock (School admin).
6. Content overview (side, addition, secondary). Counts: official courses published, school library courses, drafts, content unpublished this week, and the 3 most used courses.
7. Recent admin activity (side, addition, secondary). The last 8 audit entries (who, what, when) with a link to the audit log.

Mobile: single column in this order: summary, pending issues, platform status, AI usage and cost, users and activity, content, recent activity.
Actions: open an issue, open AI usage, manage features, open a user.
Permissions: School admin sees the AI card as read-only; Platform status management is hidden.

---

### AD-02 Users list

Purpose: find and manage any user.
Layout: header with "Create user," "Import CSV," and "Year rollover" buttons (and "Export CSV" in a menu). Tabs: All, Students, Teachers, Admins (Admins tab visible to Super admin only). Filter bar: grade, class, status (Active, Invited, Archived, Locked), last active, and search by name, student ID or email.
Table columns: checkbox, avatar and name, role, student ID or employee ID, email, grade, class(es), status chip, last active, and a row menu (View, Edit, Reset password, Archive or Restore).
Bulk actions: Archive, Restore, Reset passwords, Add to class, Export CSV. Each shows an impact summary dialog with the count.
Status meanings: Active; Invited (account created, not yet signed in); Archived (cannot sign in; history kept; removed from leaderboards; shown in classes as "Archived"); Locked (too many failed sign-ins).
Mobile: stacked cards.

---

### AD-03 User detail

Purpose: view and manage one user.
Layout: header with avatar, name, role, status chip, and actions: Edit, Reset password, Archive or Restore.
Tabs:
- Profile: all fields (name; display name and leaderboard setting for students; student or employee ID; email; grade for students; role; classes; created date; created by). Edit mode in place with Save and Cancel; a changed-fields summary on save.
- Learning (students): progress by course, average score, level, XP and coins (read-only), badges earned, streak. Teachers: classes, courses authored, assignments created, grading turnaround (mock).
- Activity: sign-in history (date, device type, result) and recent actions.
- AI usage: usage this month by feature, limits in effect, and override fields (raise or lower this user's AI limits; reason required; audit logged).
- Notes: private admin notes (not visible to the user).
Reset password dialog: generates a temporary password (shown once, with Copy and Print buttons; no email is sent), requires the user to change it at the next sign-in, and states that the user will be signed out everywhere. The action is audit logged.
Archive dialog: explains consequences ("Cannot sign in. Removed from leaderboards. History and grades stay. Can be restored.") with the count of classes affected. For a teacher: a warning lists classes where they are the only teacher and requires reassigning a teacher first.
Permissions: School admin cannot open Admin accounts.

---

### AD-04 Create user

Purpose: add one user manually.
Layout: a single form page with a summary panel on the right.
Fields: role (Student or Teacher; admins are created in AD-28), first and last name, display name (students; defaults to first name and initial), student or employee ID (auto-generated with an override), email (optional for students, required for teachers), grade (students; 7 to 12), class (students; optional, multiple allowed), subjects and classes (teachers), initial password (generated, copy button; must change on first sign-in). No email is sent; the credentials are shown once after creation for the school to hand out.
Validation: duplicate ID or email detection with a link to the existing user.
Actions: Create user, Create and add another, Cancel. After creating, a success panel shows the credentials once, with "Copy" and "Print credentials." The user must set a new password at first sign-in.

---

### AD-05 CSV import wizard

Purpose: create or update many users at once.
Layout: a full-page wizard with a step indicator (a true sequence).
Steps:
1. Upload. Choose the import type (Students, Teachers, or Class enrollments). Download a template CSV. Drag a file or choose one. Limits stated (up to 2,000 rows, CSV only, UTF-8).
2. Map columns. A table matching CSV columns to platform fields, auto-detected, with an "AI suggest mapping" button for messy headers. Required fields are marked.
3. Validate. A results table with row numbers and a status per row (OK, Warning, Error) and the reason ("Email already used by another account," "Grade must be 7 to 12," "Class not found"). Filters: All, Errors, Warnings. The admin can fix a value inline or exclude a row. "Fix with AI" proposes corrections for common problems (typos in grade or class names) shown as a diff for approval. "Download error report" as CSV.
4. Review. A summary: N users will be created, N updated, N skipped, N classes will be created, N students will be enrolled. A choice for duplicates (skip or update).
5. Import. A progress bar and live counts. The admin can leave and gets a notification when done.
6. Result. A summary with counts, a list of failed rows, and "Download credentials sheet" (CSV with temporary passwords, shown once; the page warns to store it securely) and "Print credentials."
Rules: the import is not partial by default: rows with errors are excluded and listed; valid rows are imported. A completed import creates one audit entry listing the counts.
Mobile: shows "Best on a larger screen."

---

### AD-06 Year rollover

Purpose: move students to the next grade at the start of a school year safely.
Layout: full-page wizard, steps in sequence, each step must be completed before the next.
Steps:
1. Scope. Select the school year being closed and opened (for example 2026 to 2027) and which grades to include (all by default).
2. Grade mapping. A table: from grade, to grade (7 to 8, 8 to 9, 9 to 10, 10 to 11, 11 to 12, 12 to Graduated/Archived). Each row shows the number of students. An exceptions list lets the admin search students to RETAIN in their current grade (repeat year) or to move differently. Grade 12 default: archive as graduated (history kept).
3. Classes. Choose what happens to existing classes: archive old classes (default) and create new classes for the new year. The page proposes new classes (names, grade, students split) with a button "Suggest with AI." Teachers can be carried over to the new classes (checkbox per class). Courses are re-assigned: each new class gets the official courses for its grade (editable).
4. Preview impact. Exact counts: promoted, retained, graduated, classes archived, classes created, course assignments created, and what is preserved ("XP, level, coins, badges, streaks and certificates are kept"). Warnings for edge cases (students with no class, teachers with no class).
5. Confirm. The danger zone dialog with typed confirmation ("ROLLOVER") and a scheduled option (run now or at a date/time).
6. Result. A summary and a link "Undo rollover" valid for 7 days (restores grades and class membership; assumption). A notification goes to every teacher.
Notes: weekly leaderboards reset by schedule independently of rollover; all-time leaderboards by grade follow the student into the new grade.

---

### AD-07 Classes list

Purpose: manage all classes in the school.
Layout: header with "Create class." Filters: grade, teacher, status (Active, Archived), created by (teacher or admin), search. Table: class name, grade, teachers (avatars), student count, courses, created by, status, and a row menu (Open, Edit, Archive, Delete).
Create class dialog: name, grade, school year and term, teachers (multi-select; co-teaching allowed), students (pick from the roster or leave empty), courses to attach. A "Create several classes" mode creates classes like 7A to 7D with a naming pattern.
Rules: classes created by teachers appear here with the creator shown. Delete is only available when the class has no submissions or results; otherwise only Archive is offered with a explanation. Delete uses the danger zone pattern.

---

### AD-08 Class detail (admin view)

Purpose: manage a class's teachers, students, courses and status.
Layout: header band (name, grade, term, student count, status) with actions: Edit, Archive, Delete.
Sections: Teachers (list with Add and Remove; a class must keep at least one teacher; shows who added whom), Students (table with Add, Remove, Move to another class), Courses (attached courses with Add and Remove; official courses show an Official chip), Rules summary (read-only view of the class rules the teachers set, with "Last changed by"), and Activity (recent events).
Permissions: School admin and Super admin the same.

---

### AD-09 Curriculum management

Purpose: define and maintain the school's OFFICIAL curriculum.
Hierarchy (as in the original plan): Grade, Term, Unit, Lesson, Activity, Assessment. (Assumption: official COURSES, such as Main Course, Reading Club and Exam Prep, are PACKAGES of units defined in the Packages tab, see section 11.)
Layout desktop: three panes. Left (320px): the curriculum tree (Grade 7 to 12, each with Terms, then Units, then Lessons, Activities, Assessments), with drag to reorder, expand/collapse, status dots (Draft, Published), and a school year selector at the top (curriculum is versioned per school year). Center: the editor for the selected node. Right (collapsible): "Coverage and standards" panel.
Center editor by node type:
- Grade: description, learning outcomes list (the standards for that grade), default courses.
- Term: name, dates (from the school calendar), weeks, goals.
- Unit: title, objectives, skills covered, term, estimated hours, linked outcomes, vocabulary and grammar targets.
- Lesson: summary card with "Edit lesson" (opens the lesson editor, same as teacher TC-11).
- Activity: instructions, skill, XP level, questions (Question editor).
- Assessment: link to a quiz or assignment template; passing score default.
Right panel: skill balance for the selected grade or term (bars for vocabulary, grammar, reading, writing, listening vs a target), gaps flagged (units with no assessment, outcomes not covered), duplicate content warnings.
Tabs at the top of the center area: Structure, Packages, Versions.
- Packages: define official courses per grade (name, category, which units from which terms are included, order, cover pattern). Publishing a package makes it assignable to classes and visible in the library with the Official chip.
- Versions: curriculum versions per school year (Draft, Published, Archived), a diff view, and "Duplicate to next year."
Publish: "Publish curriculum" uses the Draft/Publish/Versions pattern with an impact preview (classes using affected units, students with in-progress lessons). Published curriculum is NOT editable by teachers (they can duplicate it). Edits to a published item create "Unpublished changes."
AI: "Generate with AI" opens AD-10. Node-level AI buttons: "Suggest objectives," "Fill missing lessons," "Check coverage against the grade outcomes," "Rebalance skills."
Mobile: tree as a full-screen list; node editor full screen.

---

### AD-10 Generate official curriculum (AI wizard)

Purpose: draft a grade or term of the official curriculum with AI.
Layout: a wizard like the teacher course generator (TEACHER-SPEC TC-30) with Admin additions. Steps in sequence:
1. Scope and source. Choose Grade (one or several), Term(s), and the source: national/school standards text (paste), existing curriculum (adapt last year's), topic list, or textbook table of contents. The school's AI custom instructions (AD-21) and curriculum standards are shown as "Applied automatically" with a link.
2. Shape. Units per term, lessons per unit, weeks, skills emphasis sliders, assessment pattern (quiz per unit, term exam), course tracks to include (Main Course, Reading Club, Exam Prep), tone and level.
3. Review outline. Editable tree; regenerate any unit with an instruction.
4. Generate content. Background progress per unit; partial results appear; per-item retry; notification when done.
5. Review. Opens the curriculum tree with all generated items marked "Created with AI." A review panel offers "Quality check" (reading level fit, duplicates, age appropriateness, coverage of outcomes) and a spot-check list of low-confidence items. Items remain Draft.
6. Publish. Uses the Draft/Publish/Versions pattern. Requires the admin to confirm "I reviewed this curriculum." Super admin or School admin may publish.
Generated items are always Draft. Approval is the admin's action. No student sees anything until published.

---

### AD-11 Content management

Purpose: manage all content items in one library, official and teacher-published.
Layout: header with "Create" (menu: Course, Lesson, Activity, Quiz, Question, Vocabulary list, Grammar topic, Reading passage, Writing prompt, Media) and "Generate with AI." Tabs by type: Courses, Lessons and activities, Quizzes and assignments, Questions (school bank), Practice content (Vocabulary, Grammar, Reading, Writing prompts), Media.
Filter rail: source (Official, Teacher library), status (Draft, Published, Unpublished, Archived), grade, skill, author, last edited, flagged. Search.
Table columns: title, type chip, source chip (Official or Teacher name), grade, status chip, used by (classes count), last edited, flags, and a row menu (Preview, Edit, Duplicate, Publish, Unpublish, Archive, History).
Status rules:
- Draft: not visible to students.
- Published: visible as intended (to classes using it, or in the library).
- Unpublished: removed from the library and from new assignments. Existing classes keep access for content already started if the admin chooses "Keep for current classes" in the dialog (default), otherwise it is hidden for them too.
- Archived: hidden everywhere, kept for history.
Unpublish dialog: states how many classes and students are affected, asks for a reason (required for teacher-authored content; the teacher receives a notification with the reason), and offers "Keep for current classes."
Preview: opens a read-only student-style view (and a Teacher view for teacher-facing content) without recording progress.
Practice content: Vocabulary lists (word, part of speech, meaning, Arabic meaning, example, level), Grammar topics (rule, examples, common mistakes, practice questions), Reading passages (text, level, topic, questions, glossary), Writing prompts (task, audience, suggested length). These feed the student practice libraries and the games.
AI buttons: "Generate" (a vocabulary list for a unit, a reading passage at a level, a grammar topic with practice, writing prompts), "Quality check" (reading level, age appropriateness, bias, duplicates, missing answers), "Auto-tag" (grade, skill, topic), "Find outdated content."
Bulk actions: Publish, Unpublish, Archive, Add tag.

---

### AD-12 Content editor and preview

Purpose: edit one content item.
Behavior: opens the same editors used elsewhere: the course builder (TEACHER-SPEC TC-10), lesson editor (TC-11), quiz and assignment builders (TC-17, TC-14), and the Question editor (section 8 of the teacher spec) with Admin additions: a status control (Draft, Published, Unpublished, Archived), a version history side panel with restore, a "Preview as student" button, an "Official" toggle (Admin-authored content is Official; only Super admin and School admin can mark content official), and the flag/moderation notes panel.
For practice content (vocabulary list, grammar topic, reading passage, writing prompt): simple structured forms with a live student preview at the right.
Autosave drafts; "Unsaved changes" guard; a Publish button that opens the Draft/Publish/Versions dialog with an impact preview.

---

### AD-13 Moderation queue

Purpose: handle flagged content, reported items and failed AI jobs.
Layout: header with summary tiles (open, high severity, average age, resolved this week). Tabs: Flagged content, Reported items, Failed AI jobs, All. Filters: severity (Low, Medium, High), status (New, In review, Resolved, Dismissed), assignee, age, source.
Item types:
- Flagged content: content blocked or flagged by the AI safety rules (AD-21) or by the quality check (a teacher-published course with inappropriate content, a generated lesson flagged, an announcement flagged).
- Reported items: items users reported (a student reporting an AI Tutor answer or a piece of content; a teacher reporting library content or an AI result). The student and teacher UIs need a "Report a problem" action (see section 10).
- Failed AI jobs: a course generation, curriculum generation, bulk grading or report job that failed after retries.
- Blocked sensitive-topic messages from the AI Tutor appear under Flagged content as Low severity with a "Safety rule: sensitive topic" label. There is no separate alert type and nothing is pushed to staff.
Table: type chip, short description, source, reporter, severity, status, age (overdue chip when High is older than 24 hours), assignee, and an Open action.
Detail drawer: a snapshot of the item (content, the AI exchange, the job log), context links (class, author, content), reporter note, history of actions, and an "AI triage" block: a short AI summary, a severity suggestion, and a recommended action with "Apply."
Actions: Assign to me/another admin, Dismiss (reason), Resolve (note), Unpublish content, Edit content, Send a note to the author (a system notification, reason shown), Retry AI job, Escalate to Super admin, Mark as a safety rule gap (adds an example to the AD-21 test cases).
Mobile: stacked cards; the drawer becomes a full screen.

---

### AD-14 XP, levels, coins and streak rules

Purpose: tune the reward economy. Super admin edits; School admin views.
Layout: tabs: XP values, Levels and ranks, Coins, Streaks, Teacher bonus caps, Versions. A persistent bar at the top shows the version state ("Draft, 3 changes. Published version v7") with "Preview impact," "Discard changes," and "Publish."
- XP values: a table of actions (finish lesson, finish activity, quiz by score band, assignment submitted, assignment bonus when the teacher confirms a high grade, practice set, game, quest, streak milestone, AI Tutor quiz-me round) with XP value and a daily cap per type. Editable cells with validation.
- Levels and ranks: a levels table (1 to 60) with XP thresholds, a chart of the curve, curve presets (Gentle, Standard, Steep) that fill the table, and manual editing. Rank titles editor: names, level ranges, and plate border style picker. Impact preview shows how many students would change level.
- Coins: sources and amounts (quests, quiz results, streak milestones, badges, level-ups), daily earning caps, and a balance health view (average coins held, coins earned vs spent last 30 days, items bought) to help balance prices.
- Streaks: what counts as a learning day (checkboxes of actions), the day boundary (time zone and reset time from platform settings), freeze rules (max owned, price in the shop), milestone rewards table (3, 7, 14, 30, 60, 100 days).
- Teacher bonus caps: daily XP and coin cap per teacher per student, and whether bonus XP counts toward the leaderboard.
Publishing: effective from now or a date. A choice for level recalculation: "Recalculate levels for everyone" or "Apply to new XP only" with the impact preview. Version history and rollback.
Test panel: "Simulate a student" (enter XP, see level and rank).

---

### AD-15 Quest templates and badge definitions

Purpose: define the content of the quest system and badges.
Layout: two tabs: Quests, Badges.
Quests tab:
- Sub-tabs: Daily pool, Weekly pool, Rotation rules.
- Template list: title pattern ("Finish {n} lessons"), target type (lessons, quiz score, words learned, texts written, games played, streak days, xp earned), target value range (min and max per level band), reward (XP and coins), difficulty, grade range, skill, active toggle.
- Rotation rules: how many daily and weekly quests are drawn, balance rules (at least one skill-based, no duplicates within 3 days, scale targets to the student's level), bonus chest reward for completing all daily quests.
- Test panel: "Preview a day for a student" shows which 3 quests would be drawn.
Badges tab:
- Grid and table view of badges: icon, name, category (Learning, Streak, Quiz, Practice, Games, Social, Collector, Secret), rarity, active, earned by (count).
- Badge editor: name, description, hint text, category, rarity, icon (choose from the icon set or upload; mock), criteria builder (event, threshold, time window, optional conditions such as "grade at least 9"), reward (XP, coins, or an item), secret toggle, and a live card preview. A "Simulate" panel enters a student history and shows whether the badge would unlock.
AI helpers: "Suggest quest ideas," "Suggest badge ideas for a category," "Write descriptions and hints." Results appear as action cards; the admin approves before anything is saved.
Draft/Publish/Versions pattern applies to templates and badges.

---

### AD-16 Shop catalog

Purpose: manage what students can buy.
Layout: header with "New item" and "Create bundle." Tabs: Themes, Avatar items, Frames and titles, Power-ups, Bundles and sales.
Table per tab: preview, name, rarity, price, level required, availability (Always, Limited time with dates), status (Draft, Live, Retired), units sold, last edited, and row actions.
Item editor (dialog or drawer): name, description, kind, rarity, price, level requirement, availability window, status, and for linked kinds a link to its studio (themes to AD-18, avatar items/frames/titles to AD-17). Price guidance: each rarity has a recommended range (Common, Rare, Epic, Legendary; values set here); a warning appears when a price is outside its band.
Power-ups: streak freeze, hint pack, extra time pack: price, pack size, max owned, daily purchase limit.
Bundles and sales: create a bundle (several items, bundle price) and a sale (discount percent, dates, items or rarity). A calendar strip shows active and upcoming sales.
Rules: retired items stay owned and usable by students who have them but vanish from the shop. Price changes do not refund past buyers.
AI helper: "Suggest prices for these items based on rarity and the coin economy" (approve before applying).
Draft/Publish/Versions pattern applies.

---

### AD-17 Avatar studio

Purpose: manage avatar layers, frames and titles.
Layout: left list by category: Base characters, Outfits, Accessories, Backgrounds, Frames, Titles. Right: a grid of items with a live avatar preview panel.
Item editor: name, category and slot, asset upload (mock), rarity, how it is obtained (Shop with price, Level reward at level N, Badge reward, Event/limited, Free starter), status (Draft, Live, Retired), and a preview on the sample avatar in light and dark themes.
Frames: border style, animated or static (animation respects reduced motion), rank-style frames linked to rank titles (these are awarded automatically with the rank).
Titles: text, rarity, obtain method; moderation: a list is checked against the safety rules blocklist.
Validation: every item needs alt text and a preview; items must not overlap incompatible slots (a warning chip appears).

---

### AD-18 Themes studio

Purpose: create and publish the exotic themes students buy.
Layout: a theme list (grid with thumbnails and status) and a theme editor.
Theme editor, three areas: left controls, center live preview, right checks.
- Controls: name, description, rarity, mode (light or dark), the 9 named color tokens (ink, paper, surface, primary, spark, mint, sun, sky, danger) with color pickers and hex fields, background treatment (flat, soft pattern from a preset list, illustrated edge from a preset list), accent illustration style, corner radius scale (sharp, balanced, soft), and an optional signature motion preset (subtle, off).
- Live preview: tabs showing a student dashboard, a lesson page, a quiz question, and the shop card, all rendered with the draft theme.
- Checks: automatic contrast checks for each text/background pair with pass or fail (body text must be at least 4.5 to 1; large text 3 to 1). Publishing is blocked until all required pairs pass. A color-blind simulation toggle (protanopia, deuteranopia, tritanopia) for the preview.
Publish: sets status Live and makes the theme available to link to a shop item (AD-16). Editing a Live theme creates a new version; students keep what they own; changes apply for everyone using it immediately after publish (with an impact count of owners).
AI helper: "Generate a theme from a mood or description" (for example "Tokyo at night") proposes 3 palettes with names as action cards; the admin picks one and refines it.
Free starter themes (Daylight and Nightfall) are locked system themes: viewable and duplicable, not deletable.

---

### AD-19 Leaderboard moderation

Purpose: keep the leaderboards fair and appropriate.
Layout: header with scope tabs (Class, Grade, School) and period toggle (This week, All-time). Tabs inside: Entries, Flagged, Actions log.
Entries: the leaderboard table (rank, avatar, display name, student, class, grade, level, XP for the period) with search and filters. Row actions: Hide from leaderboards, Reset leaderboard score (period), Force rename display name, View user.
Flagged: automatically detected items with a reason: XP spike (for example more than 3 times the student's weekly average in a day), repeated game farming, inappropriate display name (matched by the blocklist), duplicate accounts suspicion. Each shows evidence and actions: Dismiss, Hide, Reset score, Rename. "AI explain" summarizes the suspicious pattern.
Definitions:
- Hide: the student does not appear on leaderboards of any scope until restored. Their XP and level are unchanged.
- Reset leaderboard score: sets the leaderboard score for the chosen period to 0 for that student. The student's real XP, level and rewards are unchanged.
- Force rename: changes the display name to first name plus initial and notifies the student.
- Reset a whole board (weekly board for a class, grade or school): a danger zone dialog with an impact preview.
Every action requires a reason and is logged in the Actions log and the audit log. A hidden student is not told by default; a toggle "Notify the student" is available.

---

### AD-20 AI features and limits

Purpose: control which AI features are on, for whom, and how much they can be used. Super admin edits; School admin views.
Layout: tabs: Features, Limits, Overrides.
Features tab: a table of every AI feature with an On/Off switch, scope (All, Selected grades, Selected classes), status, and usage in the last 7 days.
Feature list:
- Student: AI Tutor (chat), Tutor "Quiz me" mode, Writing correction in the Writing tool and in assignments, Translation helper, Explain-my-mistakes after quizzes.
- Teacher: AI grading of writing, AI question helper, Course generation, Copilot, Suggested actions, Support plans, Planner, Announcement drafting, Report comments.
- Admin: Curriculum generation, Content quality check, Moderation triage, CSV import assistant, Admin Copilot.
Turning a feature off opens a dialog with an impact summary (who loses it) and a note shown to users ("AI Tutor is turned off by your school"). Features can be scheduled (for example off during exams between two dates).
Limits tab:
- Per student: daily AI Tutor messages, daily writing checks, daily "quiz me" rounds.
- Per teacher: daily and monthly AI actions per feature and a monthly "AI credits" allowance (credits are a simple unit for generation sizes: a lesson = 1 credit, a course = N credits, a grading batch = per submission).
- School budget: a monthly spend budget with alert thresholds at 70, 90 and 100 percent, and the behavior at 100 percent: choose one: Stop all AI, Stop non-essential AI (keep AI Tutor and grading), or Warn only.
- Reset timing (midnight local time; monthly on the 1st).
Overrides tab: a list of user-specific or class-specific limit overrides (who, what, value, reason, expires), with "Add override."
What users see when limited: friendly messages ("You have used today's tutor messages. They reset at midnight."). The student and teacher specs list these states.
Draft/Publish/Versions pattern for limits and feature scopes.

---

### AD-21 AI safety rules and custom instructions

Purpose: control what the AI may say and how it behaves for this school. Super admin edits; School admin views.
Layout: tabs: Safety rules, Custom instructions, Test sandbox, Versions.
Safety rules tab:
- Age-appropriate filter level (Strict by default for grades 7 to 12; Standard; Custom) with a plain description of each.
- Blocked topics and words (lists with categories, editable), allowed focus ("Student AI Tutor answers only English-learning and study questions"), and the off-topic behavior (politely redirect, or block).
- Tone rules (encouraging, respectful, no sarcasm toward students, no shaming for mistakes).
- Personal data protection: the AI must not ask for or store personal details; mask detected phone numbers, addresses and ID numbers in logs.
- Sensitive topics: when a student mentions harming themselves, abuse, bullying or serious distress, the Tutor stops that thread and replies with the neutral message (editable text, default: "We can't process this request."). The exchange is logged as a Flagged content item (Low severity). No alert is sent to staff. (See the note in section 11.)
- Academic integrity: the Tutor explains and guides but does not simply give answers for graded work; the setting "While an assignment or quiz is open, limit the Tutor to hints" (on by default).
- Per-feature overrides (different rules for the Tutor versus teacher tools).
Custom instructions tab:
- A school-level instruction document (free text with sections: School policy, Curriculum standards and outcomes, Spelling and style (British or American), Level and tone, Things to always or never do). A structured helper inserts common blocks.
- Per-feature instruction add-ons (Tutor, Grading rubric defaults, Course generation, Announcement drafting, Report comments).
- "Draft with AI" proposes the instruction text from the curriculum and policies pasted in; the admin edits and approves.
- Version history with restore, character budget indicator, and a lint (flags contradictions and unclear rules).
Test sandbox tab: choose a feature and a role (student, teacher), type a sample prompt, and see a MOCK response and which rules fired (allowed, redirected, blocked, escalated). A saved list of test cases (including those added from moderation) can be run in batch with pass/fail results. Test cases are used before every publish.
Publish: Draft/Publish/Versions pattern; a failing test blocks publish unless the admin overrides with a reason.

---

### AD-22 AI usage and cost

Purpose: understand and control AI spend.
Layout: header with a date range selector (Today, 7 days, This month, Custom) and a filter bar (feature, role, grade, class, user).
Sections:
1. Budget summary: month-to-date spend, monthly budget bar with threshold markers, forecast, days remaining, and alert state.
2. Trend charts: requests and cost over time (line) with an optional breakdown by feature (stacked bars).
3. By feature: a table (feature, requests, average cost per request, total cost, share of spend, trend).
4. By audience: grade and class breakdown (students) and teacher breakdown (teachers).
5. Top consumers: top 10 users with usage and limit status. Link to the user's AI usage tab (AD-03).
6. Limit hits: how many times limits blocked users, by feature, with the top affected groups. Suggests adjusting limits.
7. Anomalies: automatic flags (a spike in usage, a user with unusually high usage, a failing job retrying) with "AI explain this spike" providing a plain-language summary.
Actions: Print/Save as PDF (print stylesheet), Export CSV for the tables (assumption), "Adjust limits" link (AD-20), "Set budget alert recipients" link (AD-28).
Permissions: School admin sees read-only.

---

### AD-23 AI activity log

Purpose: a school-wide record of AI actions.
Layout: header with filters: date range, feature, role, user, class, result (Approved, Edited, Discarded, Failed, Blocked by safety rules, Limit reached), and search.
Table: time, user and role, feature, short summary of the action, result chip, cost (credits or currency), and an Open action.
Detail drawer: the action summary, feature and context (page, class, content), the result and who approved it, cost, safety rule outcome, and (for authorized admins) the full input and output. Privacy rule: student AI Tutor conversation text is hidden behind a "View conversation" button. The admin must enter a reason, and the view is logged in the audit log (who, when, which conversation, why). Flagged or reported conversations still require the reason. Teacher and admin AI content is visible.
Charts at the top (optional collapse): actions by result and approvals rate (how often AI drafts are approved without edits).
Permissions: School admin sees a limited version (summaries and results, no conversation text).

---

### AD-24 School-wide announcements

Purpose: send announcements to groups across the school.
Layout: list page like the teacher announcements list (TC-26), with an added audience dimension, and a composer like TC-27.
Audience options: everyone, all students, all teachers, specific grades, specific classes, individual users. Priority (Normal, Important, Urgent). Publish now or schedule, expiry date, link to a content item.
Urgent announcements appear as a banner at the top of the student and teacher apps until dismissed or expired.
AI buttons: "Draft from a short note," tone options, shorten or lengthen, "Suggest audience." Drafts are approved by the admin before sending.
Read status: read counts and unread lists with "Remind unread."

---

### AD-25 Reports

Purpose: school-level reporting. Printable.
Layout: report picker with period selector: School overview, Learning health, Teacher activity, Content usage, AI summary.
- School overview: users by role, active users, sign-ins, growth.
- Learning health: completion and average scores by grade and class; skill breakdown (vocabulary, grammar, reading, writing, listening) per grade; classes needing support (lowest completion or scores).
- Teacher activity: assignments created, grading turnaround time (median), announcements sent, classes with no recent activity (counts, not rankings by name in the printed version unless the admin toggles it).
- Content usage: most used courses, least used, official versus teacher library, unpublished this period.
- AI summary: usage, cost, approvals, limit hits (mirrors AD-22).
Each report has an AI written summary at the top (editable), charts with table alternatives, and Print/Save as PDF using the print stylesheet. A "Compare grades" mode places grades side by side.

---

### AD-26 Audit log

Purpose: a read-only record of sensitive actions.
Layout: filters: actor, action type (Users, Roles, Classes, Curriculum, Content, Gamification rules, AI settings, Leaderboard, Settings, Rollover, Logins), target, date range; search.
Table: time, actor and role, action, target, summary, and an Open action.
Detail drawer: the before and after values (diff view), the reason entered, source (IP placeholder, device type), and links to the target.
Retention: shown from settings (for example 24 months). Entries cannot be edited or deleted.
Permissions: School admin sees only entries in their scope (users, classes, content).
If a teacher grade-change audit trail is adopted (teacher spec open question), grade changes appear here under "Grades."

---

### AD-27 Platform settings (Super admin only)

Purpose: configure the platform.
Layout: left tab list, right form panel, a fixed bar for Save and Discard, and "Last changed by" under each section.
Tabs:
- General: platform name, school name, school logo (upload; the original logo is never modified and is shown unchanged), contact email, support link, terms and privacy links, and the footer text.
- Language and region: the interface language is fixed to English (read-only); Translation tool languages (English and Arabic; read-only); spelling variant (British or American) used by AI and sample content; time zone; date and time format; first day of the week.
- Notifications: which notification types exist and their defaults for students and teachers (streak reminders, deadline reminders, announcements, badges), the default reminder time, and admin alert rules (who gets pending issues, AI budget thresholds, import finished, failed jobs, security events). Delivery channel: in-app only (the platform sends no emails).
- Features: master switches for non-AI features with grade scoping: Games, Shop, Leaderboards, Avatars and themes, Certificates, Translation tool, Announcements, Practice libraries. (AI features live in AD-20 and are shown here as a read-only summary with a link.) Turning a feature off shows an impact dialog and a message students see.
- Platform preferences: the school calendar (school years and terms with start and end dates), weekly leaderboard reset day (Monday by default), the day boundary and reset time for streaks and daily quests, default passing mark, default quiz rules (attempts), default late policy (used to prefill classes), session length, and the leaderboard privacy defaults.
- Security: password rules (length, complexity), temporary password rules, sign-in lockout (attempts and duration), session timeout, "Require two-step verification for admin accounts" toggle, and "Allow sign-in from new devices notification."
- Data: audit log and AI log retention periods, archive retention for users, and a maintenance mode switch with a banner message for users (read-only mode for students and teachers).
Changes to Security and Features use impact previews. Everything audit logged.

---

### AD-28 Admins and roles (Super admin only)

Purpose: manage admin accounts and special recipients.
Layout: a table of admins (name, email, role, status, last sign-in, two-step status) with "Invite admin" and a row menu (Change role, Deactivate, Reset password).
Roles: Super admin and School admin. A read-only permissions matrix (section 3) is shown on a tab. Rule: there must always be at least one Super admin; the last Super admin cannot be demoted or deactivated.
Designated recipients: choose admins who receive AI budget alerts, security alerts and pending issue digests (in-app notifications).
Invite dialog: email (used as the sign-in identifier, no email is sent), name, role; shows the temporary password once with Copy and Print.

---

### AD-29 Notifications (admin)

Purpose: the admin's inbox.
Layout: tabs: All, Needs action, System. Items: new high-severity issue, failed job, AI budget threshold reached, feature auto-paused by limit, import finished, rollover finished, teacher published a course to the library (digest option), security events (lockouts, failed sign-in bursts), admin invited.
Each item has one action button. "Mark all as read." The bell dropdown shows the latest 6.

---

## 7. AI TOUCHPOINTS FOR THE ADMIN (SUMMARY)

All AI results follow the AI action card pattern (TEACHER-SPEC 4.10): nothing is saved, published, sent or applied without the admin pressing Approve.
- Curriculum: generate a grade or term, suggest objectives, fill missing lessons, check coverage against outcomes, rebalance skills (AD-09, AD-10).
- Content: generate practice content, quality check, auto-tag, find outdated content (AD-11).
- Moderation: triage summary and recommended action (AD-13).
- Users: import column mapping and error fixing, rollover class suggestions (AD-05, AD-06).
- Engagement: quest and badge ideas, price suggestions, theme generation, suspicious activity explanations (AD-15, AD-16, AD-18, AD-19).
- AI governance: draft custom instructions, lint instructions, explain usage spikes (AD-21, AD-22).
- Communication and reporting: announcement drafting, report summaries (AD-24, AD-25).
- Admin Copilot: the same panel as the teacher Copilot, with admin context (current page, selected user/class/content). Example requests: "Show me students inactive for 14 days in grade 9," "Draft an urgent announcement about Sunday's maintenance," "Why did AI cost jump on Tuesday?" It can navigate and prepare action cards but cannot apply changes without Approve.

---

## 8. MOCK DATA ENTITIES (names only, for consistency across tasks)

Admin: id, name, email, role (super, school), status, lastSignIn, twoStepEnabled.
User: id, role, name, displayName, studentId/employeeId, email, grade, classIds, status (active, invited, archived, locked), lastActive, createdBy, notes.
Class: id, name, grade, schoolYear, term, teacherIds, studentIds, courseIds, createdBy, status.
Curriculum: id, schoolYear, version, status, grades.
Grade, Term, Unit, Lesson, Activity, Assessment: as in the student and teacher specs plus outcomes (learning outcomes), status, source (official, teacher).
Package: id, grade, name, category, unitIds, status.
ContentItem: id, type, title, source (official, teacher), authorId, grade, skill, status (draft, published, unpublished, archived), usedByClassIds, flags, version.
PracticeContent: VocabularyList, GrammarTopic, ReadingPassage, WritingPrompt (fields as in AD-11).
ModerationItem: id, type (flagged, reported, failedJob), source, reporterId, severity, status, assigneeId, createdAt, snapshot, aiTriage.
XpRules: version, actionValues, dailyCaps, levels (thresholds), ranks, coinRules, streakRules, bonusCaps.
QuestTemplate: id, pool (daily, weekly), titlePattern, targetType, targetRange, reward, difficulty, gradeRange, skill, active.
BadgeDefinition: id, name, category, rarity, description, hint, criteria, reward, secret, active.
ShopItem: id, kind, name, rarity, price, levelRequired, availability, status, unitsSold, linkedAssetId.
Bundle, Sale: id, items, price or discount, dates.
AvatarAsset: id, category, slot, rarity, obtain, status.
Theme: id, name, rarity, mode, tokens (9 colors), background, radius, motionPreset, status, checks.
LeaderboardFlag: id, studentId, reason, evidence, status.
LeaderboardAction: id, adminId, studentId, action, scope, period, reason, createdAt.
AiFeatureSetting: feature, enabled, scope (all, grades, classes), schedule.
AiLimits: perStudent, perTeacher, schoolBudget, thresholds, atLimitBehavior, overrides.
AiSafetyRules: filterLevel, blockedTopics, offTopicBehavior, tone, privacy, sensitiveTopics, integrity, perFeature.
AiInstructions: schoolText, perFeatureAddons, version.
AiTestCase: id, feature, role, prompt, expectedOutcome, lastResult.
AiUsageRecord: id, date, feature, userId, role, grade, classId, requests, cost.
AiLogEntry: id, time, userId, feature, summary, result, cost, safetyOutcome, flagged.
Announcement (admin): id, title, body, audience, priority, publishAt, expiresAt, status, readBy.
AuditEntry: id, actorId, action, targetType, targetId, before, after, reason, createdAt.
PlatformSettings: general, region, notificationDefaults, featureSwitches, calendar, preferences, security, data.
Notification (admin): id, kind, title, createdAt, read, link.

---

## 9. CROSS-PAGE BEHAVIOR SUMMARY

- Draft, Publish, Versions pattern is used for: XP rules, curriculum, quest and badge definitions, shop items, themes, AI feature scopes and limits, AI safety rules, and AI instructions.
- Danger zone pattern with impact preview and (for the most severe) typed confirmation: year rollover, delete class, reset a board, archive many users, disable a feature.
- Everything writes to the audit log with before and after.
- Read-only for School admin on engagement and AI settings, with a lock icon and explanation.
- Admin changes that reach users: unpublishing content (author notified), feature switches (users see a message), limits (users see a friendly limit message), safety rule outcomes (users see a calm explanation), rollover (teachers notified), announcements, leaderboard actions (optionally the student), and password resets.
- Nothing AI-made is applied without Approve.

---

## 10. REQUIRED CHANGES TO THE STUDENT AND TEACHER SPECS (apply once this file is approved)

Student spec:
1. Add "Report a problem" to AI Tutor messages, lessons, and shared content (feeds AD-13). One small menu item with a short reason selector and an optional note.
2. Add AI states everywhere an AI feature appears: Off ("AI Tutor is turned off by your school"), limit reached ("You have used today's tutor messages. They reset at midnight."), safety redirect (a calm message that explains what the Tutor can help with), and the neutral "We can't process this request." message for blocked sensitive topics.
3. Shop (ST-27): support Limited time, Retired (not shown unless owned), Sale price, Bundles, and rarity price bands from AD-16; avatar items, frames, titles from AD-17; themes from AD-18.
4. Leaderboard (ST-25): hidden students do not appear; display name rules and forced rename from AD-19.
5. Dashboard and ST-30: show an Urgent announcement banner (AD-24) and "From your school" announcements.
6. Courses (ST-02/03): an Official chip for courses from the official curriculum.
7. Settings (ST-31): display name rules; leaderboard visibility toggle respects admin defaults.
8. Archived accounts: sign-in blocked screen text ("This account is not active. Ask your school.").
9. First sign-in and password: a "Set a new password" screen after signing in with a temporary password (and after an admin reset). There is no email reset flow; students ask their school.
10. Class invites (from teachers) appear in ST-30 notifications with Accept and Decline buttons, since no email is sent.

Teacher spec:
1. Library (TC-09): Official courses appear with an Official chip, are not editable by teachers, and can be duplicated; courses unpublished by an admin show "Removed from the library by an admin" with the reason.
2. Add "Report a problem" to AI results and library content (feeds AD-13).
3. AI states: Off, limit reached ("Your AI credits are used. They reset on the 1st. Contact your admin."), safety redirect.
4. TC-29 AI settings: show the admin-set limits in effect (read-only) and the remaining credits meter in the top bar's AI button tooltip.
5. Teacher notifications: Admin messages (content unpublished with reason), school-wide announcements, feature changes.
6. The teacher AI activity log feeds AD-23 (same entries).

---

## 11. OPEN QUESTIONS AND ASSUMPTIONS TO CONFIRM

Assumptions I made (confirm or correct):
1. Official courses (Main Course, Reading Club, Exam Prep) are packages of units defined in the curriculum; the tree keeps your original hierarchy (Grade, Term, Unit, Lesson, Activity, Assessment).
2. School admin is read-only on gamification rules, AI settings and AI usage, and has no access to platform settings or admin accounts. Year rollover is allowed for School admin with typed confirmation.
3. Year rollover can be undone for 7 days.
4. Admins can export CSV from users and AI usage tables (in addition to print/PDF).
5. (Resolved) No wellbeing alerts. Sensitive topics get a neutral block message and a Low severity log item. Note: this is the owner's decision. If the school ever wants staff to be notified, the safe way to add it later is a designated-recipient alert in AD-28, which the spec used to include.
6. (Resolved) Admins can view any student AI conversation with a required, logged reason.
7. Gamification edits by Super admin apply going forward by default, with an optional recalculation of levels.
8. Admin Copilot exists (same component as the teacher Copilot).
9. School-wide announcements, Reports, Audit log, Security and Data settings are additions beyond the original task list.
10. Hiding or resetting leaderboard entries never changes a student's real XP, level or rewards.
11. Platform feature switches for non-AI features live in Platform settings; all AI switches live in AD-20.

Resolved in this revision: no wellbeing alerts; admins can read any conversation with a logged reason; no emails (in-app only, credentials handed out by the school).

Still open:
- Parent/guardian accounts: in or out of scope?
- "View as user" (admin impersonation for support): allowed or not?
- Data retention periods (audit log, AI log, archived users).
- A short spec is still needed for the shared sign-in pages (sign-in, set new password, account not active) and the public pages.
