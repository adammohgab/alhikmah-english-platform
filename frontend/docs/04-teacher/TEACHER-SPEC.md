# TEACHER SIDE: FULL DESIGN SPEC (v1 DRAFT)

Status: DRAFT v1. Built from the planning conversation. Nothing is final until the Open Questions section at the bottom is resolved.
Companion file: 03-student/STUDENT-SPEC.md. This file reuses its design system (section 2), shared components, Question renderer (section 7), and gamification rules (section 4). Where this file says "same as student", read the student spec.
Rule for this file: pure text. No images. A developer should be able to build any page from this file alone.

Page IDs (TC-xx) are stable. The task-breakdown step will reference them. Do not renumber after approval.

---

## 1. ROLE CONTEXT AND LOCKED DECISIONS

Who the teacher is: an English teacher at the school who manages one or more classes, builds learning content, assigns work, grades it, and tracks student progress. Teachers work mostly on laptops during planning and grading, and occasionally on phones for quick checks.

Locked decisions (from the owner):
- Teachers can create FULL custom courses (units, lessons, activities, assessments), not just quizzes.
- Teacher-created courses are private by default. A teacher can optionally publish a course to a school-wide library. Publishing to the library does NOT wait for Admin approval and goes live immediately. The Admin can unpublish it afterward.
- Both teachers and Admins can create classes.
- Co-teaching is supported: a class can have several teachers, and all of them can grade, edit class rules, and manage students. A class always has at least one teacher.
- Late submission policy is chosen PER ASSIGNMENT from three options (not accepted, accepted with a daily penalty, accepted with no penalty until a close date). The class sets the default.
- The teacher side is AI-FIRST: the goal is the least possible teacher work. AI does the first draft of nearly every task (courses, lessons, quizzes, assignments, grading and feedback, announcements, report comments, support plans for struggling students, lesson and weekly planning). The teacher reviews and approves. AI shows up as (1) a Copilot panel on every page that the teacher can talk to, (2) AI buttons inside every builder and page, (3) a "Generate a course" wizard, and (4) a daily Suggested actions list on the dashboard. Nothing AI-made reaches students without the teacher's approval.
- The Question bank (and the quiz/assignment builders) have an AI helper that drafts questions from a lesson or topic. The teacher must review and edit before anything is saved or shown to students.
- Teachers add students to a class in three ways: pick from the school roster, invite by student ID or email, and a class join code students enter themselves.
- Teachers control: bonus XP and coins for students, custom class quests/challenges, per-class quiz retake rules / unlock rules / deadlines, and viewing the class leaderboard and streaks.
- Grading of AI pre-graded writing: the teacher chooses the grading mode PER ASSIGNMENT.
- Communication with students: announcements, plus comments on graded work. No private chat/messaging.
- Teacher dashboard priorities: (1) grading queue, (2) students needing attention, (3) recent activity feed, (4) announcements shortcut.
- Reports include: print/save as PDF, compare classes side by side, per-student report card, skill breakdown (vocabulary, grammar, reading, writing, listening). No CSV export for now.
- Interface is English only.
- Frontend only: UI plus mock data. No real backend, no real AI calls.

---

## 2. DESIGN SYSTEM DELTAS FROM THE STUDENT SIDE

The token names, typography (Bricolage Grotesque headings, Figtree body), spacing unit, radius scale, accessibility floor and UI copy rules are identical to the student spec. Differences:

- Tone: calm and efficient. The teacher side has NO celebration dialogs, no confetti, no streak flames in the chrome, no coin/XP chip in the top bar. Gamification appears only where the teacher controls or views it (class leaderboard, quests, bonus awards).
- Density: denser than the student side. Tables are a primary pattern. Default row height 48px (comfortable), with a "Compact" option of 36px in Settings.
- Theme: teachers do not buy themes. They choose between the two free starters, Daylight and Nightfall, in Settings. (Assumption, see section 11.)
- Teacher accent: primary stays the electric violet, but large colored areas are avoided. Status color carries the meaning: mint = good/complete, sun = pending/attention, danger = overdue/at risk, sky = information.
- Status chips (used everywhere): Draft (neutral grey), Scheduled (sky), Open (mint), Closed (grey), Needs grading (sun), Graded (mint), Overdue (danger), At risk (danger), Archived (grey).
- Tables: sticky header, sortable columns, row selection with checkbox, bulk action bar that appears on selection, pagination (25 per page) or "Load more", column visibility menu on wide tables, empty and error states as defined for students.
- Charts: simple and readable. Use bars, lines and horizontal stacked bars. Every chart has an accessible table alternative (a "View as table" toggle) and a text summary line ("Average score rose 6 points over 4 weeks").
- Forms: labels above fields, helper text below, validation on blur, a persistent "unsaved changes" indicator, autosave on builders (drafts).

---

## 3. GLOBAL SHELL (TC-00)

### 3.1 Desktop (1200+)
Left sidebar 264px (collapsible to a 72px icon rail, remembered). Top bar 64px. Content max width 1440px (wider than the student side because of tables), 32px side padding.

Sidebar, top to bottom:
1. Platform wordmark (placeholder). School logo small at the very bottom, unchanged.
2. Dashboard.
3. Teach group: Classes, Students, Courses.
4. Assess group: Assignments, Quizzes, Question bank, Grading (with a count badge of submissions waiting).
5. Insights group: Reports.
6. Communicate group: Announcements.
7. Bottom: Notifications, Settings, and the teacher's name/avatar (opens a menu: Settings, Sign out).

Top bar, left to right: page title or breadcrumb; global search (students, classes, assignments, quizzes, questions); a Class switcher (All classes, or a single class: filters dashboard widgets and lists that support it); a "Create" button with a dropdown (New class, New course, Generate a course with AI, New assignment, New quiz, New announcement, Add question); an "Ask AI" button that opens the Copilot panel (shortcut Ctrl/Cmd+J); notification bell with unread dot; avatar menu.

### 3.2 Tablet (768 to 1199)
Sidebar collapsed to the icon rail; expands as an overlay. Tables switch to horizontal scroll with the first column frozen.

### 3.3 Mobile (under 768)
Bottom tab bar, 5 tabs: Home, Classes, Grading, Reports, More. "More" opens a list with Students, Courses, Assignments, Quizzes, Question bank, Announcements, Settings.
Builders (course, quiz, assignment) show a banner "Best on a larger screen" but still work in a simplified single-column flow. Grading works on mobile in a stacked layout.
Tables become stacked cards (one card per row with key fields and an expand). A floating "Ask AI" button opens the Copilot as a full-screen sheet.

### 3.4 Focused flows
The quiz builder, assignment builder, course builder, lesson editor and grading screen use a builder layout: the sidebar collapses to the rail, a slim header shows breadcrumb, document title (inline editable), save status ("Saved 10:42" / "Unsaved changes"), Preview, and the main action (Publish / Save).
Leaving with unsaved changes asks for confirmation.

### 3.5 Global behaviors
- Toasts for all confirmations. Destructive actions (delete, archive, unpublish) always use a confirmation dialog stating what will happen, including how many students are affected.
- A class switcher selection persists across pages during the session.
- Search is global and keyboard accessible (press "/" to focus).
- Every list supports empty state: one sentence plus one action.

---

## 4. TEACHER-CONTROLLED RULES (shared logic that pages depend on)

### 4.1 Grading modes (set per assignment)
When creating an assignment that contains writing questions, the teacher chooses one of:
1. Review each answer: the grading screen shows every writing answer with the AI score and comment, and the teacher accepts or edits each one before the submission is confirmed.
2. Overall grade with AI suggestions: the teacher sees one grade for the submission; AI suggestions appear in a side panel that the teacher can copy from. The teacher enters or accepts a single overall grade for the writing part.
3. Bulk approve: after AI finishes, the teacher can accept all AI grades for the class in one action, then edit exceptions. The grading queue shows an "Approve all AI grades (24)" button and a list of flagged low-confidence ones to look at first.
4. Manual only (AI off): no AI pre-grade; the teacher grades from scratch. (Assumption: this fourth option exists. See section 11.)
Auto-gradable questions (multiple choice, true/false, fill-in-the-blank, matching, listening) are always auto-graded. The teacher can override any auto score.

### 4.2 Grade release
Per assignment setting: "Release grades when I confirm each submission" or "Release all grades at once." Students see grades only after release. Until then, students see "Waiting for your teacher to confirm."

### 4.3 Class rules (set per class, can be overridden per quiz/assignment)
- Quiz retakes: number of attempts (1, 2, 3, unlimited), which score counts (best, latest, average), and a minimum wait between attempts.
- Unlock rules: the default hybrid rule is that quizzes and assessments unlock after the unit's lessons are completed. The teacher can: open a quiz early for the whole class, open it early for selected students, lock a unit/lesson until a date, or release content on a schedule.
- Deadlines: default due time of day, default late policy (see below), and reminder timing before deadlines.
- Late policy is chosen PER ASSIGNMENT. The three options are: (1) Not accepted after the due date, (2) Accepted with a penalty (a percentage per day late, with a maximum total penalty), (3) Accepted with no penalty until a close date. The class sets the default policy that prefills the assignment builder; the teacher can change it on each assignment. Quizzes close at their close time and have no late option.

### 4.4 Students needing attention (the detection rules)
A student is flagged when any of these is true (thresholds are editable in Settings):
- Average score on the last 3 assessments is below 50 percent.
- No learning activity for 5 or more days.
- Lost a streak of 7 or more days.
- Missed 2 or more deadlines in 30 days.
- Score dropped by 20 or more points compared with their own previous average.
Each flagged student shows the reason(s) as chips (for example "Inactive 6 days", "Avg 41 percent", "Streak lost").

### 4.5 Bonus XP and coins
- Teacher picks one student, several, or the whole class.
- Amount of XP and/or coins, within a per-day cap per teacher per student (proposal: 100 XP and 50 coins).
- A required reason (short text). The student receives a notification with the reason ("Ms. Rana gave you 30 XP: great participation").
- Every award is logged in an award history with date, amount, reason and recipients. The log cannot be edited.
- Bonus XP counts toward level and leaderboard like earned XP (assumption).

### 4.6 Custom class quests and challenges
- Fields: title, description, target (choose a preset: complete N lessons, score at least X percent on a quiz, keep an N-day streak, learn N words, play N games, or a manual check "teacher confirms"), period (start and end date), reward (XP and/or coins), audience (whole class, selected students).
- They appear in the student's quest page and dashboard under a "From your teacher" label.
- Manual-check quests show the teacher a "Confirm completion" list.
- Status: Draft, Active, Ended. Ended quests keep a results summary (who completed).

### 4.7 Publishing a course
Course visibility states:
- Draft: only the teacher sees it, not assignable.
- Private: assigned to the teacher's own classes only. Students in those classes see it.
- School library: visible to all teachers in the school (they can view and duplicate it, not edit the original). Publishing is immediate. Admin can unpublish at any time (the teacher sees "Removed from the library by an admin").
Editing a course that students are already using: changes are held as "Unpublished changes" and applied when the teacher clicks "Publish changes". The dialog states how many students are in the course and warns that completed lessons stay completed.

### 4.8 AI question helper
Where it appears: Question bank page (button "Generate with AI"), and the "Add question" menu inside the quiz builder, assignment builder, activity editor.
Flow:
1. A dialog asks for the source: a topic (free text), one of the teacher's lessons (picker), or pasted text.
2. Settings: number of questions (1 to 20), question types allowed (in quizzes the writing type is hidden), skill, difficulty, grade level (7 to 12), and optional notes ("focus on past simple").
3. A "Generating" state, then results appear as DRAFT question cards, each marked with an "AI draft" chip. Each card shows the full question as students would see it, the correct answer, and the explanation.
4. For each draft the teacher can Accept (saves to the bank or adds to the quiz), Edit (opens the Question editor), Regenerate this one, or Discard. A bulk "Accept selected" exists.
5. Nothing is saved or visible to students until the teacher accepts. Accepted questions keep a small "Created with AI" tag visible only to teachers.
Error state: "The helper could not generate questions. Try a shorter source or different settings." with a retry. UI only, mock results, no real AI call.

### 4.9 Co-teaching
- A class has one or more teachers. All co-teachers have equal rights on that class: edit class rules, manage the roster, create and grade assignments and quizzes, post class announcements, award bonuses, and create class quests.
- Any co-teacher can add another teacher from the school teacher list. Any co-teacher can remove another co-teacher, but the last teacher cannot be removed. Admins can also add or remove teachers. Deleting a class is Admin-only.
- Authorship: courses, quizzes, assignments and questions remain owned by the teacher who created them. Co-teachers can assign any course already attached to the class, and can edit an assignment or quiz that belongs to this class. Editing the underlying course content is limited to its author (a co-teacher can duplicate it).
- Attribution: grades, rule changes, and bonus awards record who did them and when ("Graded by Ms. Rana, 3 Oct, 10:42"; "Rules last changed by Mr. Omar").
- Grading collisions: the grading screen shows a soft lock chip when another co-teacher has the submission open ("Mr. Omar is grading this"). A teacher can open it anyway after a warning.
- Notifications: new submissions notify all co-teachers of the class. A grading queue filter "Assigned to me / All" is available (default: All).

### 4.10 AI-first workflow: principles and the AI action card
Principles:
1. AI prepares, the teacher approves. AI produces the first draft of almost every task. The teacher is the reviewer.
2. Nothing AI-made is visible to students, graded as final, sent, or scheduled until the teacher presses Approve. This has no exceptions and cannot be turned off.
3. Things that do not reach students are allowed to happen automatically: detecting students who need attention, preparing grading drafts, preparing suggested actions.
4. AI only uses data the teacher can already see (their own classes, students and content, plus the school library). No cross-teacher private data.
5. Everything AI-made is tagged "Created with AI" (teacher-only tag) until the teacher edits or approves it, after which the tag changes to "Reviewed."
6. Every AI result is an ACTION CARD, never loose text (see below).
7. Undo: after Approve, a toast offers Undo for 30 seconds. Approved publishing can always be reverted to draft.
8. Everything is mock data and mock responses in this phase.

AI action card (the shared pattern, build once):
- Header: what the AI did in one sentence ("Created a 10-question quiz on present perfect for 8B").
- Preview: the content itself (rendered the way students will see it) or, for multi-change actions, a plain list of exactly what will change ("Creates 1 quiz with 10 questions. Assigns it to 8B and 8C. Opens Thursday 08:00. Closes Friday 17:00. Notifies 46 students.").
- "Based on": the sources AI used (lesson titles, class data, dates) as small links.
- Notes: limits and uncertainty ("2 questions have low confidence").
- Buttons: Approve (primary), Edit (opens the right editor), Regenerate (with an optional instruction such as "make it easier"), Discard.
- States: Generating (progress text), Ready, Approved, Edited, Discarded, Failed (explains what failed and offers retry).

### 4.11 AI Copilot (panel, available on every page)
Opening: the "Ask AI" button in the top bar (or Ctrl/Cmd+J). A 420px right-side panel on desktop that pushes or overlays content; a full-screen sheet on mobile. It stays open while the teacher navigates.
Context: a row of context chips at the top shows what the Copilot currently knows (page, selected class, student, assignment, quiz, or course). The teacher can remove or add chips. Example: "Class 8B" and "Assignment: Unit 3 essay."
Conversation: the teacher writes plain-language requests. Copilot replies with a short sentence plus ACTION CARDS (4.10). Multi-step requests become a plan: a checklist of steps, each its own action card, with "Approve all" and per-step Approve. Steps that depend on others show "after step 1."
Example requests it must support:
- "Make a 10-question quiz on present perfect for 8B, open Thursday, due Friday 5pm."
- "Draft an announcement telling 7A the exam moved to Tuesday."
- "Who is struggling with writing in 9C and what should I do about it?" (answers with a summary and a support plan action card)
- "Plan next week for 10A around Unit 4."
- "Write report card comments for all of 9B."
- "Build a 6-unit course on travel English for grade 8."
- "Grade the Unit 3 essays and show me the ones I need to check."
- "Open the grading queue."
Also: suggested prompts that change by page (on the quiz builder: "Check my quiz", "Make it easier", "Add 5 questions on listening").
History: a conversation list ("New chat," past chats, search) and a link to the AI activity log (Settings).
What it cannot do: delete classes or content, change grades silently, send or publish anything without an approved action card, change settings without showing the change, or access other teachers' private data. When asked, it explains why in one sentence and offers the nearest allowed action.
States: empty (suggested prompts), thinking, error ("The assistant could not complete that. Try rephrasing or breaking it into smaller steps."), and rate limit.
Mobile: full-screen; context chips collapse to a single line.

### 4.12 Suggested actions (dashboard AI list)
- A list generated daily (and refreshed when data changes) of the most useful next steps, each shown as a small card: icon, one-line suggestion, a short "why" line, and a primary button that produces the matching action card (4.10).
- Examples:
  - "9 AI-graded essays in 8B are ready. Review and approve." (opens the grading queue or prepares Approve all)
  - "5 students in 9C missed most conditional questions. Create a practice assignment."
  - "The Unit 4 quiz opens Thursday and 3 questions have no correct answer. Fix them."
  - "No announcement to 7A in 12 days. Draft a weekly update."
  - "Report cards are due in 5 days. Draft comments for 9B."
  - "Maya's streak ended after 21 days. Suggest a quick encouraging announcement and a bonus."
- Card controls: Dismiss, Snooze (tomorrow / next week), and "Why am I seeing this" (shows the data behind it).
- A teacher can turn suggestion categories on or off in Settings. The daily refresh time is set there too.
- Maximum 8 shown overall, 4 on the dashboard strip, the rest under "See all."

---

## 5. SITEMAP (ROUTES AND PAGE IDS)

```
TC-00  Shell (all pages)
TC-01  /teacher                                Dashboard
TC-02  /teacher/classes                        Classes list (+ create class)
TC-03  /teacher/classes/[classId]              Class detail (tabs)
TC-04  /teacher/classes/[classId]/students     Class roster and enrollment (add/invite/join code)
TC-05  /teacher/classes/[classId]/rules        Class rules (retakes, unlock, deadlines, late policy)
TC-06  /teacher/classes/[classId]/rewards      Class rewards (bonus XP/coins, custom quests, leaderboard and streaks)
TC-07  /teacher/students                       All my students
TC-08  /teacher/students/[studentId]           Student progress
TC-09  /teacher/courses                        Courses (My courses, School library)
TC-10  /teacher/courses/[courseId]/edit        Course builder (structure)
TC-11  /teacher/courses/[courseId]/lessons/[lessonId]/edit  Lesson editor
TC-12  /teacher/courses/[courseId]/publish     Course publish and assign to classes
TC-13  /teacher/assignments                    Assignments list
TC-14  /teacher/assignments/new and /[id]/edit Assignment builder
TC-15  /teacher/assignments/[id]               Assignment results (submissions)
TC-16  /teacher/quizzes                        Quizzes list
TC-17  /teacher/quizzes/new and /[id]/edit     Quiz builder
TC-18  /teacher/quizzes/[id]                   Quiz results and item analysis
TC-19  /teacher/question-bank                  Question bank
TC-20  /teacher/grading                        Grading queue
TC-21  /teacher/grading/[submissionId]         Grading screen
TC-22  /teacher/reports                        Reports hub
TC-23  /teacher/reports/class/[classId]        Class report
TC-24  /teacher/reports/compare                Compare classes
TC-25  /teacher/reports/student/[studentId]    Student report card
TC-26  /teacher/announcements                  Announcements list (+ read status)
TC-27  /teacher/announcements/new and /[id]/edit  Announcement composer
TC-28  /teacher/notifications                  Notifications
TC-29  /teacher/settings                       Settings
TC-30  /teacher/courses/generate               Generate a course (AI wizard)
TC-31  /teacher/planner                        Planner (AI lesson and weekly planning)
TC-32  /teacher/support-plans                  Support plans (list) and /[planId] (detail)
```

Shared sub-specs: AI Copilot and AI action cards (4.10 to 4.12), AI touchpoints on every page (section 6B), Question editor (section 8), Grading panel (TC-21), Enrollment dialogs (TC-04), Rules form (TC-05), Print stylesheet for reports (section 7).

---

## 6. PAGE SPECS

Format: Purpose, Layout (desktop then mobile), Sections in order, Data, Actions, States, Links in and out.
Generic states unless overridden: Loading = skeletons shaped like the final content. Empty = one sentence plus one action. Error = what failed plus "Try again".

---

### TC-01 Dashboard

Purpose: tell the teacher what needs attention today.

Desktop layout: 12-column grid. Main column (8) and side column (4). The class switcher in the top bar filters every widget.

Sections in order:
1. Greeting line: "Good morning, {name}" and a summary sentence ("12 submissions are waiting and 4 students need attention.").
1b. Suggested actions (AI), full width, directly under the greeting. A strip of up to 4 action cards (horizontal on desktop, stacked on mobile) with a "See all (N)" link. Details in 4.12. It is slim by default (title and one button per card) so the grading queue stays prominent.
2. Grading queue (main column, highest priority). A panel listing the assignments that have submissions waiting: assignment title, class chip, number waiting, number AI-graded and ready to confirm, oldest submission age, and a "Grade" button that opens the queue filtered to that assignment. A header button "Open grading queue." If there are AI grades ready for bulk approve, show "Approve all AI grades" there.
3. Students needing attention (main column). A table of up to 6 students: avatar, name, class, reason chips, last active, and a "View student" action. "See all" opens the Students page filtered to flagged. A row action "Send announcement to this student".
4. Recent activity feed (main column). A vertical timeline of the latest 12 events across the teacher's classes: submissions received, quiz completed, student joined by code, quiz closed, a streak milestone, new badge, assignment fully submitted. Each event: icon, sentence, class chip, time, link. Filter chips: All, Submissions, Quizzes, Students.
5. Announcements shortcut (side column, top). A compact composer: title, short message, audience dropdown, and "Send" plus a link "Open full composer." Below, the last 3 announcements with read counts ("18 of 24 read").
6. My classes (side column). A compact list of classes: name, grade, student count, average progress bar, "Open." (This panel is an addition for navigation. It is visually secondary.)
7. Upcoming deadlines (side column). The next 5 assignment/quiz deadlines across classes with submission progress ("14 of 24 submitted"). (Addition, secondary.)

Mobile layout: single column in this order: greeting, grading queue, students needing attention, announcements shortcut (collapsed to a button), activity feed, classes, deadlines.

Actions: open grading, approve all AI grades, view a student, send an announcement.
States: new teacher with no classes shows a guided empty state with two buttons: "Create a class" and "Build a course".
Links out: TC-20, TC-08, TC-26/27, TC-02, TC-13/16.

---

### TC-02 Classes list

Purpose: manage and open classes.
Layout: page header with "Create class" primary button. Filter bar: grade, status (Active, Archived), search. Grid of ClassCards (3 per row on desktop, 1 on mobile), with a toggle for table view.
ClassCard: class name, grade, teacher avatars (all co-teachers), course(s) attached as chips, student count, average progress bar, average score, "needs grading" count, join code status (on/off), "Open class" button and a menu (Edit, Duplicate, Archive).
Create class dialog: name, grade (7 to 12), school year/term, co-teachers (optional, picked from the school's teachers), courses to attach (multi-select from My courses and the School library), enrollment method toggles (roster, invite, join code), description. After creating, the teacher lands on TC-04 to add students.
Note: Admins can also create classes. A class created by an Admin and assigned to a teacher shows an "Assigned by admin" chip. The teacher can edit its content settings but cannot delete it (delete is Admin-only).
States: empty = "No classes yet. Create your first class."

---

### TC-03 Class detail

Purpose: the home of one class.
Layout: header band: class name, grade, term, teacher(s), student count, join code (with copy button) and quick actions (Add students, New assignment, New quiz, New announcement, Award bonus).
Tabs below: Overview, Students, Work, Progress, Rewards, Settings. (Students leads to TC-04, Settings leads to TC-05, Rewards leads to TC-06; Overview, Work and Progress are rendered here.)
- Overview: four stat tiles (average score, completion rate, active students this week, assignments awaiting grading), a 4-week activity chart, upcoming deadlines for this class, needs-attention list for this class, and recent activity.
- Work: a combined list of this class's assignments and quizzes with status (Draft, Scheduled, Open, Closed), due date, submissions (14 of 24), average score, and actions. "New assignment" and "New quiz" buttons.
- Progress: a student-by-unit heat table (rows = students, columns = units, cell color = completion), plus a skills panel with average strength per skill (vocabulary, grammar, reading, writing, listening) and the 5 most missed questions across the class.
Mobile: tabs become a scrollable segmented control; heat table scrolls horizontally with student names frozen.

---

### TC-04 Class roster and enrollment

Purpose: add, invite, and manage students in a class.
Layout: left main: roster table. Right: enrollment panel.
Roster table columns: checkbox, avatar and name, student ID, email, status (Active, Invited, Pending request), last active, progress, average score, actions menu (View progress, Remove from class).
Bulk actions on selection: Remove from class, Send announcement to selected, Award bonus.
Enrollment panel (three methods):
1. Pick from school roster: opens a dialog with a searchable list of school students filtered by grade, with checkboxes, showing if a student is already in another of the teacher's classes. Button "Add N students."
2. Invite by student ID or email: a text area accepting several IDs or emails (comma, space or new line), used only to find the student accounts. A validation preview shows found, not found, and already enrolled. Button "Send invites." The invite appears as an in-app notification for the student with Accept and Decline (no email is sent). Invited students appear with status "Invited" until accepted.
3. Join code: displays the class code in large type with copy and regenerate buttons, an on/off toggle, an optional expiry date, and a toggle "Approve join requests manually" (on by default; proposal). Pending requests appear at the top of the roster as a "Requests" strip with Approve and Decline.
Removal: a confirmation dialog explains that progress is kept in the student's record but the class content is no longer available to them.
States: empty roster = three large buttons, one for each method.

---

### TC-05 Class rules

Purpose: set how this class behaves.
Layout: a settings form in grouped sections with one Save bar fixed at the bottom ("Unsaved changes" with Save and Discard).
Sections:
- Quiz attempts: number of attempts (1, 2, 3, unlimited), which score counts (best, latest, average), minimum wait between attempts (none, 10 min, 1 hour, 1 day).
- Content unlocking: default rule text ("Quizzes unlock after the unit's lessons are completed"); a table of units with per-unit controls (Open by default, Lock until date, Release on schedule); a table of quizzes with a toggle "Open early for the whole class" and "Open early for selected students" (opens a picker).
- Deadlines: default due time, reminders (1 day before, 1 hour before), default late policy (see 4.3).
- Answer visibility: whether students see correct answers after a quiz (Never, After submit, After the quiz closes).
- Teachers: the list of teachers on this class (avatar, name, "Added by"), an "Add co-teacher" button (picker of school teachers), and a "Remove" action on each other teacher (disabled when only one teacher remains).
- Per-assignment overrides note: "Individual quizzes and assignments can override these values."
A line under the form shows "Rules last changed by {teacher} on {date}." Saving shows a toast and updates affected quizzes, listing the number affected in a confirmation dialog when a change alters already-open quizzes.

---

### TC-06 Class rewards

Purpose: teacher-controlled gamification for a class.
Layout: tabs: Leaderboard and streaks, Quests, Bonus awards.
- Leaderboard and streaks: the class leaderboard (same layout as the student page but with more data: rank, student, level, XP this week, XP all-time, current streak, best streak, last active). Filter by period (This week, All-time). Sort by any column. A "Streaks" panel lists current streaks sorted with at-risk streaks (no activity today) highlighted. Teachers see names in full (no privacy initials).
- Quests: list of custom class quests with status (Draft, Active, Ended), progress (11 of 24 completed), dates and reward; "New quest" opens the quest form from 4.6; manual-check quests show a "Confirm completion" list.
- Bonus awards: a form (choose students, XP, coins, reason), cap indicator ("You have 70 XP left to award to this student today") and the award history table (date, students, amount, reason). 
Mobile: tabs become a segmented control; tables become stacked cards.

---

### TC-07 All my students

Purpose: find any student across the teacher's classes.
Layout: page header, filter bar (class, grade, status flags: All, Needs attention, Inactive, Top performers), search. Table.
Columns: avatar and name, class, grade, level, progress (bar), average score, last active, streak, flags (chips), "View" action.
Row selection allows: Send announcement to selected, Award bonus.
Mobile: stacked cards.
States: empty with filter = "No students match these filters."

---

### TC-08 Student progress

Purpose: understand one student in depth.
Layout: header (avatar, name, class, grade, level and rank, streak, last active, flags as chips) with actions: Award bonus, Send announcement to this student, Open report card (TC-25).
Tabs: Overview, Courses, Quizzes, Assignments, Skills and mistakes, Activity.
- Overview: stat tiles (overall progress, average score, lessons completed, words learned), a score trend line (last 10 assessments), a weekly activity bar chart, and the attention reasons if flagged with plain-language suggestions ("Inactive for 6 days. Consider an announcement or a quest.").
- Courses: each course with a progress bar and a unit-by-unit completion list.
- Quizzes: table (quiz, date, score, attempts, time) with link to the student's attempt review.
- Assignments: table (assignment, due, submitted at, status, grade) with link to the graded submission.
- Skills and mistakes: bars for the five skills with trend arrows; "Common mistakes" lists: grammar topics most missed (with count), words most missed, question types with the lowest accuracy. Each item has a "Create practice for this" shortcut (opens the question bank filtered by that topic).
- Activity: chronological log of the student's learning events.
Comments on graded work are visible here by link, and no messaging exists.

---

### TC-09 Courses

Purpose: manage the teacher's courses and browse the school library.
Layout: page header with "New course" button. Tabs: My courses, School library.
My courses: CourseCards showing cover pattern, name, grade, category (Main course, Reading Club, Exam Prep, Custom), visibility chip (Draft, Private, School library), units count, classes using it, students count, last edited; menu: Edit, Duplicate, Assign to classes, Publish to library, Archive.
School library: CourseCards from all teachers (author name, grade, units, "Used by 6 classes"), filter by grade and category, search, and actions: Preview (read-only view of the structure), Duplicate to my courses. A course the admin removed does not appear.
New course dialog: name, grade, category, description, start from (Blank, Duplicate an existing course, Template).
States: empty = "Build your first course or copy one from the library."

---

### TC-10 Course builder

Purpose: build the course structure. Builder layout.
Hierarchy: Course, Unit, Lesson / Activity / Assessment (quiz). (A "Term" grouping is optional and appears as a label on units.)
Layout desktop: left panel (320px): the course tree with drag-to-reorder, expand/collapse, an "Add unit" button at the bottom, and "Add" menus inside each unit (Add lesson, Add activity, Add quiz). Selecting a node opens its editor in the main panel.
Main panel by node type:
- Course: name, description, grade, category, cover pattern picker, estimated hours, visibility chip, and the "Publish" menu (opens TC-12).
- Unit: title, description, objectives (add/remove sentences), skills covered (multi-select skill chips), term label, estimated duration.
- Lesson: summary card with title, minutes, blocks count and an "Edit lesson" button (opens TC-11).
- Activity: title, skill, instructions, XP reward (select Low/Medium/High mapped to XP values), questions list (uses the Question editor, section 8), time estimate.
- Quiz node: choose "Create new quiz here" (opens TC-17 inside the unit context) or "Link an existing quiz."
Right panel (collapsible): "Checklist" showing what is missing before publishing (units without lessons, activities without questions, missing objectives) and a student-view preview toggle.
Rules reminder text at the bottom of the unit editor: "Quizzes in this unit will unlock after students complete its lessons."
Save: autosave drafts; "Preview as student" opens a read-only student-style view of the course.
Mobile: the tree is a full-screen list; tapping a node opens its editor full screen with a back button.

---

### TC-11 Lesson editor

Purpose: author a lesson as ordered blocks. Builder layout.
Layout desktop: main canvas (the lesson in a student-like reading column) with a block list; right panel for block settings.
Block types (matches the student lesson page): Text (basic formatting: headings, bold, italic, lists, links), Audio (upload placeholder or link, transcript field), Video (link/embed placeholder, captions note), Image (upload placeholder, alt text required), Example box (sentence with target language highlight), Key words (list of words with meaning and example, linked to students' vocabulary library), Check yourself (2 to 3 ungraded questions, uses the Question editor), Resources (link list).
Controls: "Add block" between blocks (menu), drag handle to reorder, duplicate, delete, and a keyboard-accessible "Move up/down."
Top bar: title (inline), minutes estimate, skill chips, Preview as student, Save.
Uploads are UI only (mock file chooser with a file-name chip). No storage.
Mobile: blocks as a simple stacked list; block settings open in a bottom sheet.

---

### TC-12 Course publish and assign

Purpose: decide who can use the course. Dialog or full page.
Content: three visibility options as selectable rows (Private to my classes, School library, Draft); a list of the teacher's classes with checkboxes to assign the course; an optional start date per class; a summary line ("Assigned to 3 classes, 68 students"). For the School library option, a notice: "Publishing is immediate. Other teachers can copy this course. An admin can remove it."
Buttons: Publish, Save as draft, Cancel. After publishing a toast confirms and links to the course.
If the course already has students and unpublished changes, the dialog shows the change list and the warning from section 4.7.

---

### TC-13 Assignments list

Purpose: see every assignment and its status.
Layout: page header with "New assignment." Filters: class, course, status (Draft, Scheduled, Open, Closed, Needs grading), search; sort by due date.
Table columns: title, class chips, course/unit, due date, status chip, submissions (14 of 24 with a mini bar), waiting to grade, average score, actions menu (Edit, Duplicate, Close early, Delete (drafts only), View results).
Mobile: stacked cards.

---

### TC-14 Assignment builder

Purpose: create an assignment that students solve on the platform. Builder layout, three columns on desktop.
Left column: settings in collapsible groups.
- Basics: title, instructions (rich text), course/unit link (optional), classes (multi-select) with grade shown.
- Schedule: publish now or schedule date/time, due date/time, close date (for late work), late policy (three options from 4.3: Not accepted, Accepted with daily penalty with fields for percent per day and maximum penalty, Accepted with no penalty until the close date; the class default is prefilled and can be changed here).
- Scoring: total points (auto-sum from questions), passing mark (optional).
- Grading: grading mode (the four options in 4.1; shown only if writing questions exist), grade release (4.2).
- Student view: allow resume (always on), show correct answers to students (never, after grading), shuffle questions, shuffle options.
- Resources: link list (view-only for students; uploads are UI-only mock).
Center column: the question list: numbered cards (these are a true sequence), each with type icon, prompt preview, points, and drag handle. "Add question" menu (New question, From question bank, Generate with AI). Question types: multiple choice, true/false, fill in the blank, matching, listening, writing.
Right column: Question editor (section 8) for the selected question.
Top bar actions: Preview as student, Save draft, Publish (opens a review dialog with a validation checklist: has questions, points set, classes selected, due date in the future, writing questions have a rubric if AI grading is on).
Mobile: settings, questions and editor become three steps (stepper) in a single column flow.

---

### TC-15 Assignment results

Purpose: see who submitted and move to grading.
Layout: header with assignment title, class(es), due date, status, and summary tiles (submitted 14 of 24, graded 6, waiting 8, average score 72 percent, late 2). Buttons: "Grade submissions" (opens TC-21 at the first waiting submission), "Send reminder" (to students who have not submitted; creates a student notification), "Close early", "Release grades" (if release-all mode).
Table: student, status (Not started, In progress, Submitted, AI graded, Graded), submitted at (with a Late chip), time spent, auto score, writing score (AI or Teacher with label), final grade, and an "Open" action.
Charts: score distribution (histogram) and per-question accuracy bars (shows which questions were hardest).
Filters by status and class; sort by any column.

---

### TC-16 Quizzes list

Same layout as TC-13 (Assignments list) with these differences: columns are title, class chips, unit, question count, time limit, attempts allowed, status (Draft, Scheduled, Open, Closed), attempts taken, average score, and actions (Edit, Duplicate, Open early, Close, View results). No grading status because quizzes are auto-graded only.

---

### TC-17 Quiz builder

Purpose: create a timed, auto-graded quiz. Builder layout, same three-column structure as TC-14.
Left column settings:
- Basics: title, instructions, grade, class(es), course/unit link (the quiz belongs to a unit when created from the course builder).
- Timing: time limit in minutes (or none), open date/time, close date/time.
- Scoring: total score (auto-sum), passing score (percent), points per question editable per question.
- Attempts: attempts allowed (class default prefilled, override allowed), which score counts, wait between attempts.
- Student view: shuffle questions, shuffle options, show answers after (Never, After submit, After close).
- Rules reminder: "Hints and power-ups are disabled in quizzes." (read-only text)
Center: question list with numbered cards, reorder, "Add question" (New question, From question bank, Generate with AI). Question types: multiple choice, true/false, fill in the blank, matching, listening. NO writing type in quizzes (the type is hidden here, and the validation explains why if a bank question is writing).
Right: Question editor (section 8).
Top bar: Preview as student, Save draft, Publish (validation checklist: at least 1 question, every question has a correct answer, points set, classes selected, open date valid).
Side tools: "Add N random questions from the bank with filters" (a dialog with filters for skill, difficulty, and count).

---

### TC-18 Quiz results and item analysis

Purpose: understand how a class did on a quiz.
Layout: header with quiz title, status, dates, and summary tiles (attempts, completion rate, average score, highest, lowest, average time).
Sections:
1. Score distribution histogram with pass line.
2. Student table: student, attempts used, best/counted score, time, status (Passed/Not passed/Not attempted), actions ("Grant extra attempt", "View attempt").
3. Item analysis: per question: percent correct, most common wrong answer, average time, and a flag "Might be too hard/too easy/confusing" if percent correct is extreme. "Edit question" and "Add to question bank" shortcuts.
4. Skills breakdown of the quiz (accuracy per skill chip).
Print/save as PDF button (print stylesheet from section 7).

---

### TC-19 Question bank

Purpose: store and reuse questions.
Layout: page header with "Add question", "Generate with AI" and "Import" (placeholder, disabled with tooltip "Coming soon"). Left filter rail (collapsible): source (Mine, School library), type, skill, difficulty (Easy, Medium, Hard), grade, tags/topics, and "Used in" status. Main: search field plus a table or list.
Columns/fields: prompt preview, type chip, skill chip, difficulty chip, grade, topic tags, times used, percent correct across students, last edited, and row actions (Edit, Duplicate, Add to quiz/assignment, Delete).
Row selection actions: Add to quiz, Add to assignment, Add tag, Delete.
Add/Edit question uses the Question editor (section 8) in a dialog/side drawer with extra fields: difficulty, topic tags, grade, visibility (Mine or Share with school).
The "Generate with AI" button opens the AI question helper dialog (section 4.8). Generated drafts appear in a review tray at the top of the page with the "AI draft" chip until accepted or discarded.
Mobile: list cards with filters in a bottom sheet.
States: empty = "Your question bank is empty. Add a question or browse the school bank."

---

### TC-20 Grading queue

Purpose: find submissions that need teacher confirmation.
Layout: page header with summary tiles (waiting, AI-ready to confirm, flagged low-confidence, graded today). Filters: class, assignment, status (Waiting, AI graded, Flagged, Graded), sort by oldest first by default. A segmented view toggle: By assignment (grouped) or Flat list.
By assignment: each assignment is a collapsible group with its grading mode chip, counts, and group actions: "Start grading" and, when mode is Bulk approve, "Approve all AI grades (N)" with a confirmation dialog that lists the exceptions that will be skipped (flagged ones).
Flat list: table with student, assignment, class, submitted at, AI status (Pending, Done, Flagged, Off), AI confidence chip, and a "Grade" action.
Keyboard: Enter opens, arrow keys move.
Co-teaching: a filter "Assigned to me / All" (default All) and a soft-lock chip "Being graded by {teacher}" on rows another co-teacher has open.
States: empty = "Nothing to grade. You are all caught up."

---

### TC-21 Grading screen

Purpose: grade one submission efficiently. Builder-style focused layout.
Desktop layout, three panes:
- Left (240px, collapsible): the queue for this assignment: students with status dots; the current one is highlighted; keyboard "J/K" or arrows to move.
- Center: the student's submission in a student-like read-only view, question by question. Auto-graded questions show the student's answer, the correct answer, and the auto score (editable with an override reason). Writing questions show the full text with word count, with inline highlights from the AI where present.
- Right (360px): the Grading panel, whose behavior depends on the assignment's grading mode:
  1. Review each answer: for each writing question, an AI card (score, rubric breakdown, comment) and a teacher card (score field, comment field). Buttons "Accept AI" (copies the AI score and comment into the teacher fields) and "Edit." The submission can be confirmed only after every writing question has a teacher decision.
  2. Overall grade with AI suggestions: one overall writing grade field and one overall comment field; the AI suggestions list below with "Insert" buttons to paste into the comment.
  3. Bulk approve: this screen is used for exceptions; AI scores are prefilled and marked "Approved by bulk" or "Needs review"; the teacher edits as needed and saves.
  4. Manual only: empty score/comment fields with the rubric reference.
Common to all: rubric panel (criteria such as task completion, grammar, vocabulary, organization, with point ranges), quick comment snippets (the teacher's saved comments, insertable), "Comment on this answer" inline comments for any question (these are the comments students see on graded work), overall comment, total score summary (auto + writing = final), and the primary button "Confirm and next." Secondary: "Save for later" and "Skip."
Status markers: AI pending, AI done, Teacher confirmed. Unsaved-changes guard.
Co-teaching: a banner "{teacher} is grading this" appears when another co-teacher opened the submission in the last 10 minutes, with "Open anyway." Confirmed submissions show "Graded by {teacher} on {date}."
Late submissions: a Late chip shows the policy that applied and, for penalty policy, the penalty in points with an "Override penalty" control (reason required).
Mobile layout: single column; the queue opens as a drawer; the grading panel is a bottom sheet.

---

### TC-22 Reports hub

Purpose: pick a report.
Layout: three large option panels: Class report, Compare classes, Student report card. Each has a short description, a picker (class, classes, or student), a period selector (This term, Last 30 days, Custom range), and a "Create report" button. Below: "Recent reports" list (title, date, open again).
All reports have a Print / Save as PDF button (see section 7).

---

### TC-23 Class report

Purpose: a full picture of one class over a period. Printable.
Sections in order:
1. Report header: class, grade, teacher, period, generated date, school logo (unchanged).
2. Summary tiles: average score, completion rate, active students, assignments and quizzes in period.
3. Performance over time: line chart of weekly class average score, with a text summary.
4. Score distribution: histogram (how many students in each band).
5. Skill breakdown: horizontal bars for vocabulary, grammar, reading, writing, listening, with change since the previous period.
6. Assessments table: each assignment/quiz, date, submitted count, average, highest, lowest.
7. Students: top performers (5), students needing support (5), and full roster table with progress and average.
8. Teacher notes: an editable text area included in the print.
Controls: change period, toggle sections on/off before printing.

---

### TC-24 Compare classes

Purpose: compare 2 to 4 classes side by side.
Layout: selector bar (choose classes; classes may be from different grades with a warning chip "Different grades"), period selector.
Content: a column per class with the same metrics aligned in rows: students, average score, completion rate, active students percent, average streak, assignments on time percent. Below: a grouped bar chart for the five skills across the classes; a line chart of the weekly average per class; and a "Highlights" box with auto-written sentences ("7A leads in writing; 7C has the lowest completion").
Print/Save as PDF uses the same print stylesheet.
Mobile: classes become tabs, with a "Compare" summary table scrollable horizontally.

---

### TC-25 Student report card

Purpose: a per-student report card for a period. Printable.
Sections: header (student name, ID, class, grade, period, teacher, school logo unchanged); overall summary (average score, progress, activity days); courses table (course, progress, grades for assessments, overall); skill breakdown (five bars with a short comment line); participation (lessons completed, streak best, level and rank); strengths and areas to improve (auto-generated lists the teacher can edit); teacher comment (editable text area); signature line.
Controls: period selector, toggle sections, Print/Save as PDF.
Gamification stats (level, rank) appear in a small optional section off by default.

---

### TC-26 Announcements list

Purpose: manage what students see and check who read it.
Layout: page header with "New announcement." Filters: status (Draft, Scheduled, Published), class, priority; search.
Table: title, audience chips (class(es), grade, selected students count), priority (Normal, Important), publish time, status chip, read rate (18 of 24 with a bar), and actions (Edit, Duplicate, Delete).
Clicking a row opens a drawer: the full announcement text, the audience, and the read/unread student lists with a "Remind unread" action (re-notifies those who have not read).
Mobile: stacked cards.

---

### TC-27 Announcement composer

Purpose: write and send an announcement.
Layout: a two-column form (main and a side summary).
Fields: title, body (basic rich text: bold, italic, lists, links), audience (choose one or more: classes, a whole grade, or selected students via a picker; shows the recipient count), priority (Normal or Important; Important shows with a stronger marker to students and a dashboard card), publish time (Now or schedule date/time), optional expiry date, optional link to a lesson, quiz or assignment, and an optional attachments list (links only).
Right summary: a live student-view preview of the announcement card, recipient count, and the checklist.
Actions: Send now / Schedule, Save draft, Cancel. A confirmation dialog states the number of recipients.
Note: this is the only teacher-to-student message channel besides comments on graded work.

---

### TC-28 Notifications

Purpose: one inbox for the teacher.
Layout: tabs: All, Needs action, System. Items have icon, sentence, class chip, time, a read marker and one action button.
Event types: new submissions, AI grading finished, flagged low-confidence AI grades, student joined by code / requests to join, invite accepted, quiz closed, deadline passed with missing submissions, admin messages (course removed from library), student flagged as needing attention.
Bell dropdown shows the latest 6. "Mark all as read" on the page header.

---

### TC-29 Settings

Purpose: personal and default preferences.
Layout: left tab list, right form.
Sections:
- Profile: name and email (read-only, managed by the school), subjects, a "Signature" name used on report cards.
- Appearance: theme (Daylight or Nightfall), table density (Comfortable or Compact), text size.
- Notifications: toggles per event type from TC-28, and a daily digest option.
- Grading defaults: default grading mode, default grade release, rubric templates (create/edit rubrics with criteria and point ranges), saved comment snippets (add/edit/delete).
- Needs-attention thresholds: editable values from section 4.4.
- Class defaults: default attempts, late policy, and reminders (used to prefill class rules).
- Session: sign out.

---

### TC-30 Generate a course (AI wizard)

Purpose: turn a syllabus, topic, or text into a full course draft with minimal teacher effort.
Layout: a full-page wizard with a step indicator (these steps are a true sequence). One step visible at a time, Back and Next at the bottom, progress saved automatically so the teacher can leave and return ("Resume course generation" appears on the Courses page).
Steps:
1. Source. Choose how to start: Topic (free text), Syllabus or curriculum text (paste), Pasted lesson/reading text, Adapt an existing course (picker from My courses or School library), or Chapter list (paste a table of contents). Plus a free-text box "Anything the AI should know" (for example "weak students, exam in June").
2. Shape. Grade (7 to 12), category (Main course, Reading Club, Exam Prep, Custom), number of units, lessons per unit, total weeks, skills emphasis (vocabulary, grammar, reading, writing, listening sliders), level (below, at, above grade), tone (friendly, neutral, formal), and toggles: include activities, include a quiz per unit, include vocabulary lists, include audio scripts. Sensible defaults are prefilled so the teacher can press Next immediately.
3. Review outline. An editable tree: units with titles and objectives, lessons with titles and time estimates. The teacher can rename, reorder, add, delete, or "Regenerate this unit" with an instruction. This is the main control point before full content is generated.
4. Generate content. A progress screen showing each unit and what is being created (lessons, activities, quiz questions). It runs in the background; the teacher can leave and a notification arrives when ready. Partial results appear as they finish. Failures are shown per item with retry.
5. Review. Opens the course builder (TC-10) with every generated item tagged "Created with AI." A summary bar shows: N lessons, N activities, N quizzes, and "Reviewed N of N." Quick-review mode steps through items with Approve and Edit buttons. Spot-check suggestions highlight the items the AI is least sure about.
6. Publish and assign. Opens TC-12. Publishing a generated course requires the teacher to tick "I reviewed this course." Unreviewed items stay highlighted but do not block publishing once the teacher confirms.
Rules: the course is always created as Draft. Generated lessons use the same blocks as the lesson editor (TC-11). Generated content follows the grade level and the selected tone. Quiz questions follow the question types allowed (no writing in quizzes).
Mobile: single column, steps stack; the outline review uses an accordion.

---

### TC-31 Planner (AI lesson and weekly planning)

Purpose: plan teaching time and schedule releases, deadlines and communications with minimal effort.
Layout desktop: a calendar (Week, Month) in the main area with a left panel of class filters (colors per class) and a right panel for the selected item.
Calendar items: planned lessons (release dates), quiz open/close, assignment due dates, scheduled announcements, class quests (start/end), exam dates, and teacher notes. Items are draggable to reschedule (a confirmation toast shows what changed and who is affected).
"Plan with AI" button (primary): opens a dialog: class (one or more), range (This week, Next week, This month, Custom), goals (cover Unit 4, revise grammar, exam prep, catch-up), constraints (days off, exam dates, hours per week), and notes. AI returns a PLAN: a day-by-day schedule shown as a set of action cards grouped by day: lessons to release, activities to assign, a quiz to create and schedule, homework (a short assignment), a scheduled announcement ("This week in 8B"), a custom quest for engagement. The teacher can drag cards between days, approve each, or press "Approve plan" (shows the full change summary first).
Lesson plan view: selecting a lesson on the calendar opens a lesson plan (AI-generated, teacher-only): objectives, timing breakdown (warm-up, presentation, practice, wrap-up with minutes), in-class activities and discussion questions, materials, differentiation notes (support and challenge), and an exit question. "Regenerate," "Edit," and "Print" (print stylesheet from section 7).
Mobile: agenda list view by day instead of a grid; Plan with AI is a floating button.
States: empty calendar = "Plan your first week with AI."

---

### TC-32 Support plans (AI help plans for struggling students)

Purpose: turn the "students needing attention" signals into concrete help with almost no teacher effort.
List page layout: header with "New support plan" and filters (class, status, issue). Table: student (or group), class, issue chips (for example "Conditionals," "Writing structure," "Inactive"), status (Draft, Active, Review due, Completed), created date, progress toward goals (bar), review date, and an Open action.
Ways a plan starts: the "Create support plan" button on a flagged student (TC-08), from a Suggested action (4.12), from the Copilot, or "New support plan" here (pick a student or several).
Group plans: when several students share an issue, one plan covers the group (one targeted assignment, one quest, one announcement).
Plan detail page (opens from the list):
1. Diagnosis: AI summary of what is going wrong, with evidence links (for example "Missed 7 of 10 conditional questions across the last 3 quizzes," "No activity for 6 days").
2. Goals: 2 to 3 measurable goals with a target and a date (for example "Reach 70 percent on conditionals by 24 Oct").
3. Steps: AI-prepared ACTION CARDS the teacher approves individually: a targeted practice assignment (8 to 10 questions on the weak topic, built from the question bank or generated), a custom quest for the student or group, a short encouraging announcement addressed to the student or group, a bonus XP award to apply when a goal is met, and a suggested class-level reteach note. Each shows the exact change before Approve.
4. Timeline: the review date and the milestones.
5. Progress: auto-updating metrics against each goal, a trend chart, and a status suggestion ("On track," "Needs a new approach").
6. Outcome: when completed, the teacher (or AI draft) writes a short outcome note; the plan archives.
Privacy rule: students NEVER see the words "support plan" or the diagnosis. They only receive normal items: an assignment, a quest, an announcement or a bonus. Plans are visible only to the teacher(s) of that class and Admins.
Co-teaching: all teachers of the class can see and edit the plan; changes show "last changed by."
Mobile: plan detail is a single column with collapsible sections.

---

### 6B. AI TOUCHPOINTS ON EXISTING PAGES (what the AI buttons do)

The AI Copilot (4.11) can do everything below via conversation. These are the one-click versions placed on pages. Every result is an ACTION CARD (4.10).

- TC-01 Dashboard: Suggested actions strip (4.12); "Approve all AI grades"; "Draft this week's update."
- TC-02 Classes: "Suggest a class setup" (names, rules, default course from the grade and term).
- TC-03 Class detail: "Summarize this class" (a short written summary of strengths, risks, and next steps) and "Plan the next 2 weeks" (opens the Planner).
- TC-05 Class rules: "Suggest rules for this class" based on its level and history (attempts, wait times, reminders).
- TC-06 Class rewards: "Suggest a class quest," "Suggest bonus awards" (students who improved most or helped others; the teacher approves each award).
- TC-08 Student progress: "Summarize this student," "Create a support plan."
- TC-09 Courses: "Generate a course" (opens TC-30), "Adapt a library course to my class."
- TC-10 Course builder: "Generate units from an outline," "Suggest objectives," "Fill the empty lessons," "Check this course for gaps and repeated content," "Balance the skills."
- TC-11 Lesson editor: "Draft this lesson from its title and objectives," "Add examples," "Simplify for a lower level," "Make it more challenging," "Write the audio script," "Create check questions," "Shorten or lengthen."
- TC-14 Assignment builder: "Create an assignment from a lesson or unit," "Write the instructions," "Create a rubric," "Check my assignment" (unclear wording, missing answers, difficulty balance, time needed), "Suggest a due date based on the class workload."
- TC-15 Assignment results: "Explain these results" (plain-language summary), "Which questions were confusing," "Create a reteach practice."
- TC-17 Quiz builder: "Create a quiz from a unit," "Balance difficulty and skills," "Check my quiz," "Make it easier or harder."
- TC-18 Quiz results: "Explain these results," "Rewrite this question" (for questions flagged too hard, too easy, or confusing), "Create a retake with the missed topics."
- TC-19 Question bank: "Generate with AI" (4.8), "Find duplicates," "Auto-tag topics and difficulty."
- TC-20 Grading queue: "Grade all pending writing with AI," "Approve all AI grades," "Show me the ones I should check first."
- TC-21 Grading screen: AI score and rubric breakdown per writing answer, "Draft personal feedback," "Draft overall comment," "Explain this AI score," "Rewrite my comment to be kinder or clearer."
- TC-22 to TC-25 Reports: "Write the summary," "Write the teacher notes," and on report cards "Draft comments" for one student or "Draft comments for the whole class" (one editable comment per student, reviewed in a list with Approve all and per-student edit).
- TC-26/TC-27 Announcements: "Draft from a short note" (type "quiz on Tuesday, unit 3, bring pencils" and get a full announcement), tone options (friendly, formal, short), "Make it shorter or longer," "Suggest the audience," "Suggest the best time to publish," "Write a weekly update from class data."
- TC-28 Notifications: "Summarize what I missed today."
- TC-29 Settings: AI settings (below).

AI settings (in TC-29, section "AI assistant"):
- Writing tone: friendly, neutral, formal, concise.
- Default reading level of generated content: below grade, at grade, above grade.
- Default difficulty for generated questions.
- Suggested actions: on/off per category (grading, attention, planning, communication, reports), daily refresh time.
- Copilot: keep panel open between pages (on/off), keyboard shortcut.
- "Show why" explanations on AI cards (on by default).
- AI activity log: a table of every AI action (date, page, what it did, result: Approved, Edited, Discarded, Failed). Searchable. Read-only. (Admins can see a school-wide version.)

---

## 7. PRINT AND PDF (REPORTS)

- "Print / Save as PDF" uses the browser print dialog. No server-side PDF.
- A dedicated print stylesheet: hides the sidebar, top bar, buttons and filters; uses a white background; shows the school logo (unchanged), report title, class or student, period and generated date in a header; page breaks never split a chart, table row group or summary block; charts render in high-contrast, print-safe colors with labels (not color-only).
- A page footer shows "Page X of Y" and the platform name.
- Reports default to A4 portrait; wide tables allow landscape.

---

## 8. SHARED SUB-SPEC: QUESTION EDITOR

One editor is used by the quiz builder, assignment builder, activity editor, lesson "Check yourself" block, and question bank. It edits one question.

Common fields: question type (selector), prompt (rich text with optional image and audio placeholders), points, skill (vocabulary, grammar, reading, writing, listening), difficulty (Easy, Medium, Hard), topic tags, explanation shown after answering, and a live "Student view" preview underneath.
Type-specific fields:
- Multiple choice: 3 to 5 options, one correct (or "multiple answers" mode with several correct), reorder, "Shuffle options" toggle.
- True/false: the correct answer toggle.
- Fill in the blank: a sentence where the teacher marks blanks and enters accepted answers per blank (several accepted spellings allowed; case sensitivity toggle), or word-bank mode.
- Matching: pairs list (left items and right items), with distractors allowed.
- Listening: audio placeholder (upload/link UI) with a replay limit, transcript (hidden from students until review) and one of the answer types above.
- Writing (assignments, practice and activities only): prompt, min and max words, rubric selection (from rubric templates), sample answer (hidden), and the AI grading toggle (when the assignment mode uses AI).
Validation: every question needs a prompt, a correct answer (except writing), and points. Errors are inline and listed in the builder's checklist.
Actions: Save, Duplicate, Delete, "Save to question bank" toggle.

---

## 9. MOCK DATA ENTITIES (names only, for consistency across tasks)

Teacher: id, name, email, subjects, classes, settings (theme, density, grading defaults, thresholds).
Class: id, name, grade, term, teacherIds, courseIds, studentIds, joinCode (code, enabled, expiresAt, requireApproval), rules (attempts, scorePolicy, wait, defaultDue, latePolicy, reminders, answerVisibility), createdBy (teacher or admin).
Student (teacher view): id, name, displayName, studentId, email, class, grade, level, xp, streak, progress, avgScore, lastActive, flags.
Course: id, name, grade, category, authorId, visibility (draft, private, library), units, version, hasUnpublishedChanges, assignedClassIds.
Unit, Lesson (blocks), Activity, Quiz, Assignment, Question: same as student spec plus authorId, difficulty, tags, timesUsed, percentCorrect, visibility.
Assignment (teacher fields): id, title, classIds, courseId, unitId, schedule, dueAt, closeAt, latePolicy, gradingMode, gradeRelease, points, questions, status, submissions.
Submission: id, assignmentId, studentId, status, submittedAt, isLate, autoScore, writingAnswers (text, wordCount, aiScore, aiConfidence, aiComment, teacherScore, teacherComment), finalScore, confirmedAt, comments, gradedBy, lockedBy, latePenalty.
Rubric: id, name, criteria (name, maxPoints, descriptors).
CommentSnippet: id, text.
Quest (class): id, classId, title, target, period, reward, audience, status, completions.
BonusAward: id, teacherId, studentIds, xp, coins, reason, createdAt.
Announcement: id, title, body, audience, priority, publishAt, expiresAt, status, readBy.
Notification (teacher): id, kind, title, createdAt, read, link.
Report: id, kind (class, compare, student), params, createdAt.
AiDraft: id, source (topic, lesson, pasted text), settings, questions, status (draft, accepted, discarded), createdBy.
AiActionCard: id, kind (create quiz, create assignment, announcement, lesson draft, course draft, grade draft, support step, schedule change, bonus award), summary, preview, changes, sources, status (generating, ready, approved, edited, discarded, failed), createdAt.
CopilotConversation: id, messages, contextChips, actionCardIds.
SuggestedAction: id, category, text, why, cardKind, status (new, snoozed, dismissed, done).
CourseGenerationJob: id, source, shape, outline, progress, status, courseId.
PlannerItem: id, classId, type (lesson, quiz, assignment, announcement, quest, note), date, status.
LessonPlan: id, lessonId, objectives, timing, activities, discussion, materials, differentiation.
SupportPlan: id, studentIds, issues, diagnosis, goals, steps, reviewDate, status, outcomeNote.
AiActivityLog: id, teacherId, page, action, result, createdAt.
Audit fields on Class rules, Submission grades and BonusAward: changedBy, changedAt.

---

## 10. CROSS-PAGE BEHAVIOR SUMMARY

- Class switcher persists and filters lists, dashboard widgets and the grading queue.
- Anything created in a builder starts as Draft with autosave, and is only visible to students after Publish.
- Destructive actions always show the number of students affected.
- Teacher actions that reach students: publishing content, announcements, bonus awards, custom quests, grade release, comments on graded work, reminders for missing submissions, early unlocks. Each creates a student-side notification (see student spec ST-30).
- Teachers see real student names everywhere; students only see display names on leaderboards.
- AI: every AI result is an action card and nothing AI-made reaches students without teacher approval (4.10). AI-made content is tagged "Created with AI" for teachers only.
- Comments on graded work appear on the student's result page (ST-14), labeled "Teacher feedback."

### Required changes to the student spec (to apply once this file is approved)
1. ST-24 Quests and ST-01 Dashboard: show a "From your teacher" group for custom class quests.
2. ST-02/ST-03: show courses assigned by the teacher and library courses; show a "Teacher" and "Custom" chip.
3. ST-05 or ST-04: honor teacher unlock overrides (locked until a date, opened early) with an explanation.
4. ST-14: label comments as Teacher feedback; support grade release timing.
5. ST-11/ST-12: show late policy and close date.
6. ST-13 and ST-12: show a late banner with the policy that applies (not accepted, penalty, or free until close date) and the close date.
7. ST-30: add teacher notifications: bonus received with the reason, reminder to submit, new announcement.

---

## 11. OPEN QUESTIONS AND ASSUMPTIONS TO CONFIRM

Assumptions I made (confirm or correct):
1. Teachers get only the two free themes (Daylight and Nightfall) and a density setting. No shop.
2. A fourth grading mode "Manual only (AI off)" exists in addition to the three you listed.
3. Bonus XP counts toward level and leaderboard, with a daily cap per teacher per student (100 XP, 50 coins; placeholders).
4. Join-code requests require manual teacher approval by default.
5. (Resolved) Late policy is chosen per assignment; class default prefills it.
6. Teachers can send a "reminder" notification to students with missing submissions. (This is a system notification, not a message.)
7. Quizzes contain no writing questions.
8. The dashboard includes two secondary side panels you did not list (My classes, Upcoming deadlines) for navigation.
9. No CSV export, only print/PDF.
10. A teacher sees only students in their own classes (and school roster only when adding students).
11. Publishing a fully AI-generated course requires one confirmation tick ("I reviewed this course") rather than reviewing every item.
12. Suggested actions sit in a slim strip under the greeting, above the grading queue.
13. Support plans are invisible to students (they only see the normal items created from them) and are visible to co-teachers and Admins.
14. The Copilot can only act through approved action cards. It cannot delete content or change grades silently.
15. The Planner schedules release dates, deadlines and announcements on the platform; it does not model the school timetable or rooms.
16. Bonus awards suggested by AI still need teacher approval and respect the daily caps.

Resolved in this revision: late policy is per assignment; co-teaching is allowed with equal rights; the Question bank has an AI question helper; the teacher side is AI-first (Copilot, AI buttons, course wizard, suggested actions).

Still open:
- Should there be a full audit trail page for grade changes (who changed a grade and when)? Co-teaching makes this more useful. The spec currently shows only "last changed by" labels.
- Can a co-teacher edit another teacher's course content, or only duplicate it? (Spec currently: author only.)
- Is there a parent/guardian view? (Affects report cards and announcements.)
- Does the Admin approve a class created by a teacher, or can teachers create classes freely? (Spec currently: freely.)
