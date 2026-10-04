# STUDENT SIDE: FULL DESIGN SPEC (v1 DRAFT)

Status: DRAFT v1. Built from the planning conversation. Nothing here is final until the Open Questions section at the bottom is resolved.
Scope: everything a student sees and does. Teacher and Admin get their own spec files later (04-teacher, 05-admin) in the same format.
Rule for this file: it is pure text. No images. Anyone should be able to build any page from this file alone, without asking questions.

Page IDs (ST-xx) are stable. The task-breakdown step will reference them, so do not renumber after approval.

---

## 1. PRODUCT CONTEXT AND LOCKED DECISIONS

What it is: an English-learning platform for a private school (Al Hikmah). Students log in, follow courses made of units and lessons, take quizzes, solve assignments, practice skills, chat with an AI tutor, play solo games, and earn rewards.

Stack: Next.js, TypeScript, Tailwind CSS. Frontend only for now: UI plus mock data. No real backend, no real AI API, no real payments.

Locked decisions (from the owner):
- Users are students in grades 7 to 12.
- The interface is English only. Arabic appears only inside the Translation tool (Arabic text must render right-to-left inside that tool; the rest of the page stays left-to-right).
- The platform does NOT use the school logo colors. It gets its own distinct identity. It must not look like a generic AI-generated SaaS template. (The school logo itself can still appear unchanged in the footer/about area and on certificates; it just does not drive the palette.)
- Navigation: left sidebar on desktop, bottom tab bar on mobile.
- Gamification is a core pillar, not a side feature: XP, levels with rank titles, streaks, daily quests and weekly goals, badges, class/grade/school leaderboards, avatars, coins, a reward shop, certificates, power-ups, and purchasable themes.
- Dashboard priority order: (1) daily quests and streak, (2) XP / level / rank, (3) upcoming deadlines.
- Progression is hybrid: units are open for any student to enter. Quizzes and assessments inside a unit unlock only after the lessons in that unit are completed.
- A student sees several courses per grade (for example Main Course, Reading Club, Exam Prep).
- Assignments are created and solved fully inside the platform. No file uploads, no audio recording, no handwriting photos.
- Quiz is auto-graded only. Assignment can include writing questions that are AI pre-graded and then confirmed by the teacher.
- Quiz retakes are decided by the teacher per quiz.
- Vocabulary, Grammar, Reading, Writing each have two modes: lesson-linked practice and a personal library.
- Games are solo only (against the clock or against the student's own best score).
- AI Tutor can: free chat about English, explain grammar/vocabulary from the current lesson, check and correct writing, quiz the student on what they learned. (No speaking/pronunciation practice for now.)
- Themes are colorful and exotic, bought with coins. Not just light/dark.
- Notifications: bell dropdown, a full notifications page, and an announcements card on the dashboard.
- Leaderboards: class, grade, whole school; each with weekly (resets) and all-time views.

---

## 2. DESIGN SYSTEM

### 2.1 Design intent
Feel: a place students want to open every day. Closer to a well-made game launcher crossed with a personal study notebook than to a school portal or an admin template. Confident, a little playful, never childish (users are 12 to 18).

One memorable thing: the progress identity. The student's level, XP and streak are drawn as a single recognizable "badge plate" component (see 2.6) that follows the student through the app. Everything else stays calmer so that element carries the personality.

Things to avoid (these are the tells of a templated look):
- A page made of identical rounded cards with the same soft grey shadow.
- Gradient washes used as decoration.
- A tracked-out ALL-CAPS label above every heading.
- Numbered markers (01, 02, 03) unless the content is truly a sequence (lesson steps, quiz questions, units in order are fine).
- Accenting one word in every headline.
- Fade-and-slide-up entrance on every section, and hover motion on every card.
- Using the school logo colors.

### 2.2 Default theme tokens ("Daylight", the free starter theme)
Named colors (proposal, can be tuned during implementation but token NAMES are fixed):
- ink: #1B1740 (main text, deep blue-violet black)
- paper: #F7F5FC (page background, cool lilac white)
- surface: #FFFFFF (panels)
- primary: #5B3DF5 (electric violet; main actions, active nav)
- spark: #FF5D8F (hot coral pink; highlights, streak flame accents, notifications dot)
- mint: #17B890 (success, correct answers, completed)
- sun: #FFC233 (coins and XP gold)
- sky: #3DA9FF (info, links, listening skill)
- danger: #E5484D (errors, wrong answers, overdue)

Skill colors (used everywhere a skill appears: chips, icons, progress): vocabulary = sun, grammar = primary, reading = sky, writing = spark, listening = mint, translation = a muted teal. Never rely on color alone; every skill also has an icon and a text label.

### 2.3 Theme architecture (important for the shop)
- All colors, background pattern, corner radius, and decorative accent come from CSS variables / a theme object. No component may hard-code a color.
- A theme defines: the 9 named colors above, a page background treatment (flat color, soft pattern, or illustrated edge), an accent illustration style, corner-radius scale, and a preview thumbnail.
- Every theme must pass text contrast (body text at least 4.5:1 on its surface). Themes that fail do not ship.
- Themes are single-mode (each theme is either light or dark by design). The student picks a theme, not a "mode".
- Free starters: Daylight (light, default) and Nightfall (dark).
- Purchasable themes (coins) are exotic and colorful. Starter catalog idea: Neon Tokyo, Desert Dusk, Deep Reef, Aurora, Cyber Bazaar, Candy Arcade, Obsidian Gold, Sakura Rain. Each has a rarity (Common, Rare, Epic, Legendary) that sets its price.
- Applying a theme changes the whole student app instantly (no reload). The shop previews a theme live on a miniature dashboard before purchase.
- Selected theme id is stored per student (mock: in memory / local state).

### 2.4 Typography
- Display and headings: Bricolage Grotesque (expressive, slightly quirky grotesque with weight and width range). Used big on page titles and level numbers.
- Body and UI: Figtree (friendly, very readable at small sizes).
- Arabic (Translation tool only): IBM Plex Sans Arabic.
- Scale (px): 12, 14, 16 (body), 18, 22, 28, 36, 48, 64 (hero numbers only). Body line-height 1.55. Max line length 70 characters for any reading text.
- Headings use sentence case. No all-caps labels. Numbers use tabular figures in stats and leaderboards.

### 2.5 Shape, spacing, depth, motion
- Spacing unit 4px. Common steps: 8, 12, 16, 24, 32, 48.
- Radius scale is hierarchical, not one radius everywhere: 8 (inputs, chips), 14 (panels), 24 (hero panels and the badge plate), full (avatars, pills).
- Depth: flat by default. Elevation only for things that float (dropdowns, dialogs, the AI chat input). Cards are separated by spacing and background tone, not by a shadow on each one.
- Motion rules: purposeful only.
  - Page load: ONE orchestrated moment on the dashboard (the quest/streak/level cluster animates in once).
  - Responds to the student: button press, answer correct/wrong feedback, XP gain counting up, coin gain, level-up celebration, badge unlock, streak flame flare.
  - Reduced motion: if the OS asks for reduced motion, replace all of the above with simple fades or instant state changes.
- Celebration moments (level up, badge unlock, quest complete, certificate earned) use a full-screen or dialog moment that can be dismissed with one click or Escape.

### 2.6 Signature component: the Badge Plate
A compact horizontal plate showing: avatar (with equipped frame), level number, rank title, an XP bar to next level, streak count with flame, and coin balance.
- Full size on the Dashboard hero and Profile.
- Compact size in the top bar of every page (avatar + level + streak + coins).
- Tapping the compact plate opens the Profile.

### 2.7 Component inventory (shared, build once)
Layout: AppShell, Sidebar, TopBar, MobileTabBar, PageHeader, Section, EmptyState, ErrorState, Skeleton.
Identity and progress: BadgePlate, Avatar (with frame), XpBar, LevelChip, StreakFlame, CoinCount, ProgressRing, ProgressBar, SkillChip, RankTitle.
Content: CourseCard, UnitRow, LessonRow, ActivityRow, DeadlineRow, AnnouncementCard, NotificationItem.
Assessment: QuestionRenderer (see ST-13), QuestionNavigator, TimerPill, ResultSummary, FeedbackBlock.
Gamification: QuestCard, WeeklyGoalCard, BadgeTile, LeaderboardRow, ShopItemCard, ThemePreview, CelebrationDialog, PowerUpButton.
AI: ChatMessage, ChatInput, TypingIndicator, PromptSuggestionChips, ConversationHeader.
Generic: Button (primary/secondary/quiet/danger), IconButton, Chip, Tabs, SegmentedControl, Dialog, Drawer, Dropdown, Toast, Tooltip, SearchField, FilterBar, Pagination.

### 2.8 Writing style (UI copy)
- Sentence case. Plain verbs. Buttons say what happens: "Start quiz", "Save draft", "Submit assignment", "Buy for 450 coins".
- The same action keeps the same name everywhere ("Submit" produces a toast "Submitted").
- Errors explain what went wrong and how to fix it, and do not apologize. Empty screens invite one action.
- Tone for students: direct and a bit warm. Encouraging on failure ("2 more correct answers would have passed. Try again when ready.") and not sugary.

### 2.9 Accessibility and responsive floor
- Visible keyboard focus on everything interactive.
- Touch targets at least 44px on mobile.
- Color is never the only signal (correct/wrong also has icon and text).
- Breakpoints: mobile under 768, tablet 768 to 1199, desktop 1200 and up.
- Responsive rule: every page has a defined mobile layout (stacked, single column, bottom tab bar).
- Timers, streak, and quest states must be readable by screen readers.

---

## 3. GLOBAL SHELL (ST-00)

### 3.1 Desktop layout (1200+)
Left sidebar, 264px wide, collapsible to a 72px icon rail (remembers the choice).
Top bar across the content area, 64px tall.
Content area: max width 1280px, centered, 32px side padding.

Sidebar contents, top to bottom:
1. Platform wordmark/logo area (placeholder platform name; school logo may appear small at the very bottom of the sidebar, unchanged).
2. Home: Dashboard.
3. Learn: My courses, Assignments, Quizzes (history).
4. Practice: Vocabulary, Grammar, Reading, Writing, Translation.
5. AI Tutor.
6. Play: Games.
7. Rewards: Daily quests, Leaderboard, Achievements, Shop.
8. Bottom: Notifications, Settings, and the student's compact Badge Plate (opens Profile).
Active item: filled with primary tint plus a left indicator. Items with pending things show a small count (e.g. 2 due assignments, 3 unfinished quests).

Top bar contents, left to right: page title (or breadcrumb on deep pages), global search (courses, lessons, words), then on the right: streak flame with count, coin count, XP/level chip, notification bell with dot, avatar menu (Profile, Settings, Sign out).

### 3.2 Tablet (768 to 1199)
Sidebar collapsed to the icon rail by default, expandable as an overlay drawer. Top bar stays.

### 3.3 Mobile (under 768)
No sidebar. Top bar becomes: back arrow or hamburger, page title, bell. Streak/coins move into a slim strip under the top bar on the dashboard only.
Bottom tab bar, 5 tabs: Home, Learn, Practice, Play, Rewards.
- Learn opens a hub with Courses, Assignments, Quizzes.
- Practice opens a hub with the five skill tools and AI Tutor.
- Rewards opens a hub with Quests, Leaderboard, Achievements, Shop.
- Profile, Notifications, Settings are reached from the avatar menu in the top bar.
A floating AI Tutor button is available on lesson, activity and assignment pages.

### 3.4 Deep-page behavior
Quiz attempt, assignment solving, game play and the AI Tutor chat use a focused layout: the sidebar and tab bar hide, a slim header shows the exit button, the timer if any, and progress. Exiting mid-attempt asks for confirmation.

### 3.5 Global behaviors
- Page transitions: instant swap with a simple fade. No slide transitions.
- Toasts appear bottom-center on desktop, top on mobile.
- XP/coin gains show a small floating "+25 XP" near the top-bar chip when earned.
- A level-up or badge unlock opens CelebrationDialog on top of whatever page is active (queued if multiple).

---

## 4. GAMIFICATION RULES (shared logic that pages depend on)

All numbers are proposals for mock data and can be tuned. Visual behavior is what matters now.

### 4.1 XP
Earned for: finishing a lesson, finishing an activity, passing a quiz, submitting an assignment, finishing a practice set, finishing a game, completing a daily quest, keeping a streak milestone.
Sample values: lesson 20, activity 15, quiz by score (10 to 50), assignment submission 30 (bonus when teacher confirms a good grade), practice set 10, game 5 to 25, quest 10 to 30.
Anti-farming: repeated practice and games have a daily XP cap per type. The UI shows "Daily cap reached" calmly when hit.

### 4.2 Levels and rank titles
Levels 1 to 60. XP needed rises gradually. Rank title changes every 10 levels:
- 1 to 9: Newcomer
- 10 to 19: Explorer
- 20 to 29: Wordsmith
- 30 to 39: Storyteller
- 40 to 49: Linguist
- 50 to 59: Scholar
- 60: Grandmaster
Each rank title has its own plate border style. Rank titles can be displayed as the profile title unless the student equips a purchased title.

### 4.3 Coins
- Earned by quests, quiz results, streak milestones, badges, and level-ups. NOT earned by simply time on site.
- Spent only in the Shop.
- Coins are an in-app currency only (no real money in scope).

### 4.4 Streaks
- A streak day counts when the student completes at least one learning action that day (lesson, activity, quiz, assignment, or a practice set).
- Shows current streak, best streak, and a 7-day mini calendar.
- Streak freeze (power-up): protects one missed day. The shop sells it; the streak panel shows how many are owned and whether one was auto-used.
- Milestones at 3, 7, 14, 30, 60, 100 days give coins and a badge.

### 4.5 Daily quests and weekly goals
- 3 daily quests, refreshed at midnight. Examples: "Finish 1 lesson", "Score 80% on any quiz", "Learn 10 new words", "Write a short text", "Play 2 games".
- 3 weekly goals, reset on Monday. Examples: "Earn 500 XP", "Keep a 5-day streak", "Finish 1 assignment".
- Each quest has a progress bar, a reward (XP and/or coins), and a state: in progress, ready to claim, claimed.
- Completing all 3 daily quests gives a bonus chest (a small coin reward with a short opening animation).

### 4.6 Badges and achievements
Categories: Learning, Streak, Quiz, Practice, Games, Social (leaderboard), Collector (shop), Secret.
Each badge: name, short description, icon, rarity, state (locked with hint, in progress with bar, earned with date). Secret badges show "?" until earned. Students can pin up to 3 badges to the profile.

### 4.7 Leaderboard
Ranked by XP. Scope tabs: My class, My grade, Whole school. Period tabs: This week (resets Monday), All-time.
Shows rank, avatar with frame, display name, level, XP for that period. The student's own row is always visible (pinned at the bottom if off screen). Top 3 get a podium treatment. Movement since last week (up/down arrows) shown on weekly view.
Privacy: only display name, avatar, level and XP are shown to other students. No grades or quiz scores.

### 4.8 Certificates
Issued for: completing a course, reaching rank milestones (new rank title), and finishing a streak of 100 days. View-only in the UI, with a "Print / Save as PDF" button (browser print), no real PDF generation yet. Carries the school logo (unchanged) and student name.

### 4.9 Avatars, frames, titles
- Avatar is built from layers: base character, outfit, accessory, background. Free starter options exist.
- Frames surround the avatar everywhere it is shown (rank-style borders, animated rare frames).
- Titles are equipable text under the name ("Midnight Reader").
- Shop items have rarity and can be previewed on the student's own avatar.

### 4.10 Power-ups
Streak freeze (protect a missed day), Hint (remove two wrong options in a multiple-choice question; allowed in games and practice, NOT in teacher quizzes or assignments), Extra time (+30 seconds in timed games). Power-ups are blocked inside teacher-graded quizzes and assignments to protect fairness.

---

## 5. SITEMAP (ROUTES AND PAGE IDS)

```
ST-00  Shell (all pages)
ST-01  /student                                   Dashboard
ST-02  /student/courses                           Courses list
ST-03  /student/courses/[courseId]                Course details
ST-04  /student/courses/[courseId]/units/[unitId] Unit page
ST-05  .../lessons/[lessonId]                     Lesson page
ST-06  .../activities/[activityId]                Activity page
ST-07  /student/quizzes                           Quizzes hub (available + history)
ST-08  /student/quizzes/[quizId]                  Quiz start
ST-09  /student/quizzes/[quizId]/attempt          Quiz attempt (question + navigation)
ST-10  /student/quizzes/[quizId]/result/[attemptId]  Quiz result
ST-11  /student/assignments                       Assignments list
ST-12  /student/assignments/[id]                  Assignment details
ST-13  /student/assignments/[id]/solve            Assignment solving (autosave)
ST-14  /student/assignments/[id]/result           Assignment result and feedback
ST-15  /student/practice/vocabulary               Vocabulary
ST-16  /student/practice/grammar                  Grammar
ST-17  /student/practice/reading                  Reading
ST-18  /student/practice/writing                  Writing
ST-19  /student/practice/translation              Translation
ST-20  /student/ai-tutor                          AI Tutor
ST-21  /student/games                             Game selection
ST-22  /student/games/[gameId]/play               Game screen
ST-23  /student/games/[gameId]/result             Game results
ST-24  /student/quests                            Daily quests and weekly goals
ST-25  /student/leaderboard                       Leaderboard
ST-26  /student/achievements                      Badges and achievements
ST-27  /student/shop                              Shop (themes, avatar items, frames and titles, power-ups)
ST-28  /student/profile                           Profile and avatar editor
ST-29  /student/certificates                      Certificates
ST-30  /student/notifications                     Notifications and announcements
ST-31  /student/settings                          Settings
```

Shared sub-specs referenced by pages: Question renderer (section 7), Celebration dialog (2.5 and 4), Badge plate (2.6).

---

## 6. PAGE SPECS

Format for every page: Purpose, Layout (desktop then mobile), Sections in order, Data, Actions, States, Gamification hooks, Links in and out.
Generic states for every page unless overridden: Loading = skeletons shaped like the final content. Empty = one sentence plus one action. Error = what failed plus a "Try again" button.

---

### ST-01 Dashboard

Purpose: tell the student, in five seconds, what they should do today and how they are doing. Reward opening the app daily.

Desktop layout: 12-column grid. Top full-width hero band, then a two-column body (main 8 columns, side 4 columns).

Sections in order:
1. Greeting hero band (full width). Left: "Good evening, {first name}" with a one-line contextual nudge ("You are 1 quest away from the daily bonus chest."). Right: the full Badge Plate (avatar with frame, level and rank title, XP bar to next level, streak flame with count, coin balance). A slim "Resume" strip sits under the greeting: last lesson/activity title, course name, a progress bar, and a "Resume" button. (Resume strip is an addition so the student can jump back in; it is visually secondary to quests.)
2. Daily quests and streak (main column, top, the highest priority). Three QuestCards in a row with progress and reward. To the right of or above them, the streak panel: current streak, 7-day mini calendar with today highlighted, freeze count. A "Claim" state on completed quests. Bonus chest indicator ("2 of 3 done").
3. XP, level and rank (main column, second). A wide panel: XP earned this week as a small bar chart (7 bars), XP to next level, the rank title ladder showing current rank and the next one, and a "Weekly goals" row (3 compact goal bars).
4. Upcoming deadlines (main column, third). A list of up to 5 items soonest first: assignment or quiz title, course chip, due date with relative text ("Due tomorrow"), status chip (not started, in progress), action ("Continue" or "Start"). Overdue items appear first in danger color. "See all" links to Assignments.
5. Announcements card (side column, top). Latest 3 teacher announcements: title, teacher name, time, priority marker, unread dot. Clicking opens the announcement in a drawer (full text). "See all" opens Notifications, Announcements tab.
6. My courses (side column). Up to 3 course mini-cards: course name, grade, progress ring, "Continue". "See all" links to Courses.
7. Leaderboard snapshot (side column). My class, this week, top 3 plus my own row.
8. Recent achievements (side column, bottom). Last 3 badges earned, plus the next badge closest to unlock.

Mobile layout: single column. Order: compact strip (streak, coins), greeting + Badge Plate, Resume, daily quests (horizontal scroll), streak panel, XP/level, deadlines, announcements, courses, leaderboard snapshot, achievements.

Actions: resume learning, claim quest, open deadline item, open announcement, navigate to any "See all".
States: first-time student (no progress): quests visible, resume strip replaced by "Start your first lesson" button, deadline list shows "Nothing due".
Gamification hooks: this is the main celebration surface. Claiming a quest triggers coin/XP gain animation; claiming the third triggers the chest.
Links out: ST-05/06 (resume), ST-24, ST-11/12, ST-30, ST-02, ST-25, ST-26.

---

### ST-02 Courses list

Purpose: see every course the student is enrolled in and pick one.
Layout desktop: page header with title and a segmented filter (All, Main, Reading Club, Exam Prep, plus any course category). Grid of CourseCards, 3 per row. Mobile: 1 per row.
CourseCard shows: cover artwork (generated pattern per course, not a stock photo), course name, category chip (Main course, Reading Club, Exam Prep), grade, teacher name, number of units, progress ring with percent, "Continue" button (goes to the exact lesson the student left), small "Next: Unit 3, Lesson 2" text.
Extra: sort control (Recently used, Progress, Name). A completed course shows a "Completed" state with a certificate link.
States: no courses = "You have no courses yet. Your teacher will add you to a class."
Links: card goes to ST-03; Continue goes to the last lesson (ST-05).

---

### ST-03 Course details

Purpose: the map of a course.
Layout desktop: left main column (8) and right sticky info column (4).
Left: course header (name, category chip, grade, teacher, overall progress bar, "Continue" button). Below it, the Units list: each UnitRow is an expandable row showing unit number and title, a progress bar, count of lessons completed out of total, skill chips for skills covered, and a status (not started, in progress, completed). Expanded, it lists lessons (with done check), the activities, and the unit's quiz/assessment. The quiz row shows a lock with the reason "Finish all lessons to unlock" until the lessons are completed (hybrid rule). Units themselves are never locked.
Right sticky column: Course summary (about text, term/semester, number of lessons, total estimated time), progress ring, course XP earned, upcoming items for this course (assignments/quizzes due), and the course certificate preview (locked until complete).
Mobile: single column; the sticky column's contents move below the header as a collapsible "About this course".
Links: unit row to ST-04, lesson to ST-05, quiz to ST-08, assignment to ST-12.

---

### ST-04 Unit page

Purpose: everything inside one unit.
Layout: header band with breadcrumb (Course / Unit), unit title, short description, progress bar.
Sections in order:
1. Learning objectives: 3 to 6 "By the end of this unit you can..." sentences.
2. Skills covered: SkillChips (vocabulary, grammar, reading, writing, listening).
3. Lessons: ordered list of LessonRows (these are a true sequence, so numbering is appropriate): number, title, estimated minutes, done state, "Start" or "Review".
4. Activities: list of ActivityRows grouped by skill, each with XP reward and done state.
5. Unit assessment: card for the unit quiz showing lock state (locked until all lessons are done), question count, time, attempts allowed (teacher setting), best score if attempted.
6. Unit vocabulary: horizontal strip of key words with a "Add all to my library" action.
Mobile: same order, stacked.
Gamification hooks: finishing the unit shows a CelebrationDialog and awards a unit badge.

---

### ST-05 Lesson page

Purpose: deliver a lesson with minimal distraction.
Layout desktop: focused two-column. Main (reading column, max 70 characters wide) and a right "Lesson tools" rail (collapsible).
Main column: breadcrumb, lesson title, estimated time, skill chips. Then, in the order the teacher arranged them, content blocks: text blocks, an audio player placeholder (play/pause, scrub, speed 0.75x/1x/1.25x, transcript toggle), a video placeholder (16:9 frame with play button and captions toggle), images, example boxes ("Examples" with highlighted target language), "Key words" block, and a "Check yourself" mini-question set (2 to 3 ungraded questions with instant feedback).
Right rail: lesson outline (jump links with scroll progress), Resources (downloadable file list; mock), "My notes" (a small text area saved to the student's library), "Ask AI Tutor about this lesson" button (opens ST-20 with the lesson context attached), and an "Add to my library" action for words.
Bottom bar (sticky): Previous lesson, "Mark as complete" (primary), Next lesson. Marking complete gives XP and shows a short +20 XP moment. If the lesson has activities, a prompt offers "Do the activities".
Mobile: single column. Lesson tools become a bottom sheet opened by a tools button. Sticky bottom bar replaces the tab bar on this page.
States: completed lesson shows a "Completed" chip and "Review" mode (no XP repeat).
Links: ST-06 for activities, ST-20 for AI help, next lesson.

---

### ST-06 Activity page

Purpose: do one practice activity linked to a lesson/unit.
Layout: focused single column, max width 800px, with a header: activity title, skill chip, XP reward, estimated time, status.
Sections: Instructions card (clear text, collapsible after start), Content area (the activity body: reading passage with questions, word sorting, sentence ordering, gap fill, short dialogue completion, or similar; it reuses the Question renderer from section 7), then a bottom action bar: "Start" (before begin), then "Check answers" and "Complete activity".
Behavior: instant per-question feedback is OFF by default and shown on "Check answers". After completing: score summary, XP and any coin reward, "Retry" and "Back to unit".
States: not started, in progress (autosaves locally), completed (shows the best result and allows retry for practice without more XP).
Mobile: action bar sticky at the bottom.

---

### ST-07 Quizzes hub

Purpose: find available quizzes and review past attempts. (This merges the quiz history page into a hub with two tabs.)
Layout: page header, tabs: Available, History.
Available: list of quiz rows: title, course chip, unit, question count, time limit, attempts used out of allowed, status (Ready, Locked, Closed), best score if any, button "Start quiz" or a lock reason.
History: table (desktop) / stacked list (mobile): quiz name, date, score as number plus bar, pass/fail status chip, attempt number, "View result" action. Filter by course and by status. Sort by date.
States: empty history = "No quizzes taken yet."

---

### ST-08 Quiz start

Purpose: calm briefing before a timed activity.
Layout: centered panel (max 720px) on a plain background.
Sections: quiz title, course and unit, a facts row (number of questions, time limit, passing score, attempts left), instructions (bullet list in plain language: one sitting, timer cannot be paused, no hints/power-ups allowed, cannot go back after submit), the question types included as chips, and a checkbox "I am ready". Primary button "Start quiz", secondary "Back".
Locked state: shows the reason ("Finish 2 more lessons in this unit") with a link to those lessons.
Attempts used up: shows best score and "No attempts left. Ask your teacher."

---

### ST-09 Quiz attempt (question + navigation)

Purpose: take the quiz. Focused layout (no sidebar/tab bar).
Layout desktop: top slim bar: exit button, quiz title, TimerPill (turns danger color under 60 seconds and announces to screen readers at 5 minutes, 1 minute), progress text ("Question 4 of 12") and a progress bar. Main: the question in a wide panel using the Question renderer. Right (or below on mobile): QuestionNavigator grid.
QuestionNavigator: a grid of numbered squares (this is a true sequence). States: current, answered, flagged for review, unanswered. Tapping jumps to that question.
Controls (bottom bar): Previous, Next, "Flag for review" toggle, and on the last question "Submit quiz". Submit opens a confirmation dialog listing unanswered and flagged questions.
Behavior: answers are saved in memory as the student moves. If the time runs out, the quiz auto-submits and shows a brief "Time is up" message. Leaving asks for confirmation.
Quiz is auto-graded only, so quizzes contain no writing questions (writing belongs to assignments).
Mobile: question stacked above; navigator opens as a bottom sheet from a "Questions" button.

---

### ST-10 Quiz result

Purpose: show how the student did and what to do next.
Layout: top result panel then review list.
Top panel: big score (number and percent), pass/fail status, time taken, XP and coins earned, the pass mark, attempt number, and comparison with their previous best. A level-up or badge dialog may open on top.
Below: question-by-question review list: question text, student's answer, correct answer, short explanation, and correct/wrong icon plus text. Filter: All, Wrong only. (Teacher can disable answer reveal per quiz; if disabled, only the score and topic breakdown show.)
Also: "Topic breakdown" bars by skill so the student sees weak areas.
Actions: "Retake" (only if the teacher allows and attempts remain), "Back to unit", "Practice weak areas" (opens the matching practice tool), "Ask AI Tutor to explain my mistakes".

---

### ST-11 Assignments list

Purpose: everything the student must solve, by urgency.
Layout: page header, tabs (To do, Submitted, Graded), filter by course and sort by due date.
Row/card: assignment title, course chip, due date with relative text, status chip (Not started, In progress, Submitted, Awaiting teacher, Graded), progress (questions answered out of total), points available, action (Start / Continue / View result).
Overdue items are shown with a danger marker and are still openable if the teacher allows late work (shown as "Late work allowed until...").
Mobile: stacked list.
States: empty = "Nothing to do. Nice."

---

### ST-12 Assignment details

Purpose: brief before solving.
Layout: header (title, course, teacher), main column and right facts column.
Main: instructions (full text), resources (links/files the teacher attached, view-only), a list of question types included, and a note if some questions are writing ("These will be reviewed by your teacher").
Right (sticky): due date and time with countdown, points, number of questions, status, attempts, last saved time, and the primary button ("Start" / "Continue" / "View result").
Submission state UI (also reused in ST-11): Not started, In progress (saved), Submitted (read-only, awaiting teacher), Reviewed/Graded.

---

### ST-13 Assignment solving (autosave)

Purpose: solve the assignment on the platform. Focused layout.
Layout: like the quiz attempt but UNTIMED. Top bar: exit, title, a "Saved just now" indicator (autosave status: Saving, Saved, Could not save), progress bar, due date.
Main: question panel (Question renderer, including the writing type with a text area, live word count, minimum/maximum words, and a "Check my writing with AI" assist that shows suggestions but does NOT submit). Navigator grid and Previous/Next as in ST-09.
Controls: "Save draft" (explicit), "Submit assignment" (confirmation dialog listing unanswered questions; warns that writing answers will be reviewed by the teacher).
Rules: no power-ups. The student can leave and resume any time before submitting. After submit the assignment becomes read-only.
Mobile: same as ST-09 with sticky bottom bar.

---

### ST-14 Assignment result and feedback

Purpose: show the grade and teacher feedback.
Layout: top summary then per-question review.
Top: grade (points and percent), status, submission date, graded date, teacher name, overall teacher comment.
Per-question list: student's answer, correct answer (for auto-graded items), score for the item. For writing questions: the student's text, AI feedback summary (grammar, vocabulary, structure suggestions) shown as "AI review" and the teacher's confirmed grade and comment shown as "Teacher feedback". Clear labeling of which part is AI and which part is the teacher. If the teacher has not confirmed yet: the result shows "Waiting for your teacher to confirm" and the AI part is shown as "Preliminary".
Actions: "Back to assignments", "Ask AI Tutor about my feedback".
Gamification: XP/coin bonus appears once the teacher confirms.

---

### ST-15 Vocabulary

Purpose: learn and review words.
Layout: page header with two tabs: From my lessons, My library. A search field (searches word and meaning).
From my lessons: words grouped by unit with a "Learn" and a "Practice" button per group.
My library: personal word list the student built (added from lessons, the translator, or manually). Filters: all, learning, mastered, starred.
Word card shows: word, part of speech, pronunciation text (and a play button placeholder), meaning, an example sentence, Arabic meaning available on tap (inside this card only the Arabic text is right-to-left), mastery level (new, learning, mastered), star toggle.
Practice modes started from this page: flashcards (flip), multiple choice, spelling. A practice set ends with a result screen (score, XP) as with other sets.
Empty library = "Add your first word from a lesson or from the translator."

---

### ST-16 Grammar

Purpose: learn and practice grammar topics.
Layout: two tabs: From my lessons, My library (saved topics and personal notes).
Topic list on the left (desktop) / a list screen on mobile; a topic opens the reader.
Topic reader sections: Topic title and level, "The rule" (short explanation), "Examples" (correct examples with the target structure highlighted, plus a "Common mistake" block with the wrong version struck and the right version), "Practice" (6 to 10 questions through the Question renderer), and "Related lessons". Actions: save topic, ask AI Tutor, start practice. Practice ends with the shared result screen.

---

### ST-17 Reading

Purpose: read passages and answer questions.
Layout desktop: split view. Left: passage (max 70 characters wide, adjustable text size, optional highlight tool, glossary words underlined with hover/tap definitions). Right: questions panel with the Question renderer and a progress bar.
Tabs at the top: From my lessons, My library (saved passages and a graded-reader style list filtered by level and topic).
Header chips: skill chips (reading, plus sub-skills like scanning, inference), level, estimated reading time.
End: result summary, words to save ("Add 5 new words to my library"), XP.
Mobile: passage first, then questions below with a "Jump to questions" button.

---

### ST-18 Writing

Purpose: practice writing and get feedback.
Layout: two tabs: From my lessons (prompts tied to units), Free writing (personal).
Writing screen: prompt card (task, audience, suggested length), a large text area with a live word count, a target range indicator, a "Planning" collapsible with outline hints, and a right panel for feedback.
Actions: "Check with AI" (shows feedback in the right panel: grammar, vocabulary, structure, and a corrected version with differences marked), "Save draft", "Finish". Practice writing is not graded by the teacher unless it is part of an assignment. Feedback is a placeholder UI using mock data.
History list of past drafts with dates and word counts.

---

### ST-19 Translation

Purpose: translate and understand words and short phrases, English and Arabic.
Layout desktop: two side-by-side text panels with a swap button between them. Left = source, right = result. The direction indicator shows "English to Arabic" or "Arabic to English". Arabic text uses IBM Plex Sans Arabic and renders right-to-left in its panel only.
Below the panels, three result sections: Word explanation (meaning, part of speech, pronunciation text), Usage examples (2 to 3 example sentences with translations), and Related words (synonyms, common phrases).
Actions: copy, clear, swap, "Add to my library", "Ask AI Tutor". Recent translations list (last 10).
Mobile: panels stack vertically; swap button sits between them.
No real API: mock results.

---

### ST-20 AI Tutor

Purpose: chat with an AI that teaches English. Focused chat layout.
Layout desktop: left column (280px) conversation list ("New chat", past chats, search), center chat, optional right context panel (collapsible) showing the attached context (the lesson or text the student is asking about).
Chat area: ConversationHeader (tutor name and avatar, mode selector, clear conversation button), message list (user messages aligned to one side, tutor messages to the other, with rich content: bold terms, example sentences, mini tables), TypingIndicator, and an input area with a text box, send button and attach-context button (attach current lesson, a word, or a text).
Modes (the 4 abilities), selectable as chips above the input: Chat (free chat about English), Explain (grammar/vocabulary from the current lesson), Check my writing, Quiz me. Each mode changes the placeholder text and the first suggested prompts.
PromptSuggestionChips appear when a conversation is empty: for example "Explain present perfect", "Check this paragraph", "Quiz me on Unit 3 words".
Quiz me mode: tutor asks a question, student answers in the chat, tutor responds with feedback and a score tally at the end (XP awarded for finishing a quiz-me round with a daily cap).
Check my writing: tutor returns the corrected text and a short list of changes.
States: loading, error ("The tutor could not answer. Check your connection and try again." with a retry), rate limit, and empty state.
Guardrails shown in the UI: a one-line note that the tutor only helps with English learning. Clear conversation asks for confirmation.
Mobile: full-screen chat; the conversation list opens as a drawer.
No real API: mock responses with a short fake delay.

---

### ST-21 Game selection

Purpose: pick a game. All games are solo.
Layout: page header with "Daily play" progress (how many games played today toward the quest). Grid of 7 game tiles, 3 per row. Each tile: unique artwork, name, one-line description, skill chips, best score, plays today, difficulty selector (Easy, Medium, Hard), and "Play".
Games: Vocabulary Match, Word Builder, Grammar Challenge, Reading Challenge, Sentence Builder, Spelling, Timed Quiz.
Extra: filter by skill, "Content source" selector (From my courses, My library, Mixed), a Power-ups bar showing hint and extra-time counts.
Mobile: 2 per row, or 1 per row for readability.

---

### ST-22 Game screen

Purpose: a reusable game shell. All 7 games use the same shell with different play areas.
Layout (focused): top bar with exit, game name, score, TimerPill (or a "no timer" mode), and a progress bar. Center: the play area. Bottom: controls and Power-up buttons (hint, extra time).
Game play areas:
- Vocabulary Match: two columns of cards to pair words with meanings.
- Word Builder: letters to arrange into the target word.
- Grammar Challenge: choose the correct form to complete a sentence.
- Reading Challenge: short text then fast questions.
- Sentence Builder: drag/tap word chips into the correct order.
- Spelling: audio placeholder plus type the word.
- Timed Quiz: rapid multiple-choice questions against the clock.
Rules: solo, vs the clock or vs the student's own best score (the screen shows "Your best: 1,240"). A combo/streak counter inside the game rewards consecutive correct answers. Correct/wrong feedback is immediate with sound off by default (sound toggle in settings).
Pause: opens a dialog (Resume, Quit). Quit asks for confirmation.

---

### ST-23 Game results

Purpose: celebrate, summarize, and push the next round.
Layout: centered results panel.
Content: final score with "New personal best" indicator, correct answers out of total, accuracy, time, XP and coins earned (with daily cap note), and a short list of missed items with the correct answers (offering "Add to my library").
Actions: "Play again" (primary), "Change game", "Back to games". Quest progress updates are shown if any quest advanced.

---

### ST-24 Daily quests and weekly goals

Purpose: see and claim all quests.
Layout: page header with the time until the daily reset. Section 1: Daily quests (three QuestCards, large) with the bonus chest progress. Section 2: Weekly goals (three WeeklyGoalCards) with the time until the Monday reset. Section 3: Streak panel (current streak, best streak, month calendar, freezes owned, milestone ladder 3/7/14/30/60/100). Section 4: Quest history (last 7 days of completed quests).
Actions: Claim, Open (jump to the page where the quest is done, e.g. a lesson).

---

### ST-25 Leaderboard

Purpose: compare XP across the class, the grade and the school.
Layout: page header, two control groups: scope tabs (My class, My grade, Whole school) and period toggle (This week, All-time). A countdown to the weekly reset when on "This week".
Content: podium for the top 3, then a ranked list (LeaderboardRow: rank, movement arrow on weekly view, avatar with frame, display name, level, XP). The student's own row is highlighted and pinned if off screen. A "Nearest rivals" card shows the 2 above and 2 below the student with the XP gap ("120 XP to pass Sara").
Privacy: only display name, avatar, level and XP are public.
Mobile: podium compact, list below, scope in a dropdown.

---

### ST-26 Achievements (badges)

Purpose: collection view of all badges.
Layout: page header with total earned out of total and a progress bar. Category tabs (All, Learning, Streak, Quiz, Practice, Games, Social, Collector, Secret). Grid of BadgeTiles.
BadgeTile: icon art, name, rarity border, state (earned with date, in progress with a bar and "7 of 10", locked with a hint, secret shown as "?").
Tapping a tile opens a dialog with the description, how to earn it, progress, and "Pin to profile" (up to 3 pins).
Filters: earned, in progress, locked.

---

### ST-27 Shop

Purpose: spend coins on themes, avatar items, frames and titles, and power-ups.
Layout: page header with the coin balance prominent. Category tabs: Themes, Avatar items, Frames and titles, Power-ups. Sort by rarity or price; filter owned/not owned.
Themes tab: large ShopItemCards, each with a live miniature preview of the theme, name, rarity tag, price. "Preview" applies the theme temporarily to a mini dashboard in a dialog (and optionally to the whole app for 10 seconds with a "Keep / Cancel" bar). "Buy" confirms in a dialog ("Buy Neon Tokyo for 900 coins?"), then shows the owned state with "Apply".
Avatar items tab: grouped by slot (outfit, accessory, background). A preview shows the student's own avatar wearing the item.
Frames and titles tab: preview on the avatar and the title text under the name.
Power-ups tab: Streak freeze, Hint pack, Extra time pack, each with quantity owned, price, and a short rule ("Not usable in quizzes or assignments").
Rules: cannot buy without enough coins (button disabled with "Need 120 more coins" text). Owned items are marked. Purchases show a toast and update the balance with an animation. No real money.
Some items are also level-gated (shown as "Unlocks at level 15").

---

### ST-28 Profile and avatar editor

Purpose: identity and customization.
Layout desktop: left column (the full Badge Plate and avatar preview with an "Edit avatar" button), right column with tabs: Overview, Avatar, Stats.
Overview: name, grade, class, equipped title, pinned badges (3), recent activity, certificates preview.
Avatar tab: layered editor with slots (base, outfit, accessory, background, frame, title) and the student's owned items per slot, with a live preview and a Save button. Locked items link to the shop.
Stats tab: total XP, lessons done, quiz average, assignments submitted, words learned, total study days, longest streak, per-skill strength bars, XP over time (weekly chart).
Mobile: stacked, tabs become a segmented control.

---

### ST-29 Certificates

Purpose: view and print earned certificates.
Layout: list/grid of earned certificates (course completions, rank titles, 100-day streak) with a preview thumbnail, title, date. Unearned certificates show a lock and the requirement.
Certificate view: a large printable layout with the student's name, achievement, date, teacher/school signature area and the school logo (unchanged). Button "Print or save as PDF" uses the browser print.
Empty state: "Finish a course to earn your first certificate."

---

### ST-30 Notifications and announcements

Purpose: one inbox.
Layout: page header with "Mark all as read". Tabs: All, Announcements, Activity.
Announcements: teacher announcements with title, teacher name, class, priority marker (normal, important), time, read/unread. Opens in a drawer with the full text.
Activity: system events (quest complete, badge earned, assignment graded, new quiz available, deadline reminders, streak at risk).
Bell dropdown (from the top bar): latest 6 items with a "See all" link, unread count dot.
Each item has a clear action ("Open assignment"). Unread items have a subtle marker and a stronger title.
Empty state: "You are all caught up."

---

### ST-31 Settings

Purpose: personal preferences.
Layout: left tab list (or sections on mobile), right form panel.
Sections:
- Account: name (read-only, managed by school), email, change password (UI only), grade and class (read-only).
- Appearance: choose the active theme from the owned list, with a preview; reduce motion toggle; text size (small, default, large).
- Learning: daily goal (light, regular, serious: sets XP target), reading text size, auto-play audio toggle, show Arabic meanings toggle.
- Notifications: toggles for streak reminders, deadline reminders, announcements, new badges, leaderboard changes, and a preferred reminder time.
- Sound and effects: sound effects toggle, celebration animations toggle.
- Privacy: show my name on leaderboard (display name vs initials), show my avatar on leaderboard.
- Session: sign out.

---

## 7. SHARED SUB-SPEC: QUESTION RENDERER

One component renders every question type for quizzes, assignments, activities, practice and games. Each question has: prompt, optional media (image, audio placeholder), type, points, and a state (unanswered, answered, correct, wrong, review).

Types and their UI:
- Multiple choice: 3 to 5 options as large tappable rows with a radio mark. (Optional multiple-answer variant uses checkboxes and says "Choose all that apply".)
- True/false: two large side-by-side buttons.
- Fill in the blank: sentence with inline input(s) or a word bank to tap from.
- Matching: two columns, tap-to-pair with a line/color link; clear a pair by tapping it again.
- Listening: audio player placeholder (play, replay with a limit, speed) plus any answer type under it. Transcript hidden until review.
- Writing: text area, word count, min/max words. ONLY available in assignments and practice (never in quizzes, because quizzes are auto-graded only).
Review state: shows correct/wrong with icon and text, the correct answer, and an explanation.
Keyboard support: arrow keys and Enter on options; Tab order follows the visual order.

---

## 8. MOCK DATA ENTITIES (names only, for consistency across tasks)

Student: id, firstName, displayName, grade (7-12), class, avatar (slots), equippedThemeId, equippedTitle, level, xp, coins, streak, bestStreak, freezes, pins.
Course: id, name, category, grade, teacherName, coverPattern, units.
Unit: id, title, description, objectives, skills, lessons, activities, quizId.
Lesson: id, title, minutes, blocks (text, audio, video, image, example, keywords, checkQuestions), resources.
Activity: id, title, skill, xp, instructions, questions.
Quiz: id, title, courseId, unitId, questionCount, timeLimit, passMark, attemptsAllowed, showAnswers, state.
Assignment: id, title, courseId, dueAt, points, questions, instructions, resources, state (not started, in progress, submitted, awaiting teacher, graded), grade, teacherFeedback, aiFeedback.
Question: id, type, prompt, media, options, answer, explanation, points, skill.
Word: id, word, partOfSpeech, meaning, arabicMeaning, example, mastery, starred.
Quest: id, kind (daily/weekly), title, progress, target, reward (xp, coins), state.
Badge: id, name, category, rarity, description, progress, target, earnedAt.
ShopItem: id, kind (theme, avatar item, frame, title, power-up), name, rarity, price, levelRequired, owned.
Theme: id, name, rarity, mode, tokens (9 colors), background treatment, radius, preview.
LeaderboardEntry: rank, studentId, displayName, avatar, level, xp, movement.
Announcement: id, title, body, teacherName, className, priority, createdAt, read.
Notification: id, kind, title, createdAt, read, link.
Certificate: id, kind, title, issuedAt.

---

## 9. CROSS-PAGE BEHAVIOR SUMMARY

- Gamification triggers: lesson complete, activity complete, quiz result, assignment submit/graded, practice set, game result, quest claim, streak milestone. Each can raise XP, coins, a badge or a level-up, and may open CelebrationDialog.
- Locked content always states WHY it is locked and links to what unlocks it.
- Autosave on assignments and activities. Exit confirmation on every focused flow.
- Every page that lists records has: loading skeleton, empty state, error state.
- The AI Tutor can be launched from lessons, activities, quiz results, assignment feedback, the translator, and grammar topics, carrying context.
- Power-ups never work inside teacher quizzes or assignments.

---

## 10. OPEN QUESTIONS AND ASSUMPTIONS TO CONFIRM

Assumptions I made (please confirm or correct):
1. "Pay platform money" for themes means in-app coins earned through learning, not real money. If you mean real payments, that is a different scope (payments, parents, refunds) and should be a separate dashboard/feature.
2. Free starter themes are Daylight and Nightfall; every other theme is purchasable.
3. Quizzes contain no writing questions; writing lives in assignments and practice (since quiz is auto-graded only).
4. Quiz history is merged into the Quizzes hub (ST-07) as a tab instead of a separate page.
5. I added a "Resume" strip to the dashboard hero (not in your priority list) so students can jump back into learning. Remove it if you want the dashboard strictly quests, XP, deadlines.
6. Numbers (XP values, level count 60, rank titles, shop prices, streak milestones) are placeholders for mock data.
7. The AI Tutor has no speaking/pronunciation mode.
8. Class/grade/school leaderboard is XP-based and shows only name, avatar, level, XP.

Still open (needed before the task breakdown):
- Platform name and wordmark (placeholder is fine for now, but pages reference it).
- Is a parent/guardian view part of the platform (affects notifications and certificates)?
- Late submissions: does a late assignment lock, lose points, or stay open? (Spec currently shows "Late work allowed until...".)
- Are quest and badge definitions fixed by the platform or editable by the Admin? (Affects the admin spec.)
- Should students be able to see classmates' profiles from the leaderboard?
- Is there any sound design (sound effects, music)? Spec assumes optional effects, off by default.
