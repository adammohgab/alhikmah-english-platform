# English Platform — Landing Page Experience Specification

**Version:** 1.0  
**Scope:** Landing page / homepage frontend experience  
**Platform:** Interactive English Learning Platform  
**Primary users:** School students  
**Frontend:** React + TypeScript  
**Motion:** Lenis + GSAP / Framer Motion  
**Design goal:** Premium, immersive, interactive educational experience

---

# 1. Landing Page Philosophy

The landing page is not a traditional LMS dashboard.

It should feel like the **entrance to an interactive English-learning environment**.

The homepage should progressively introduce the platform through:

1. Featured content
2. Platform capabilities
3. Courses and lessons
4. Skills practice
5. Tests and quizzes
6. Assignments
7. AI Tutor
8. Educational Games
9. Weekly English Magazine
10. Announcements
11. Student progress
12. Final learning CTA

The experience should feel continuous rather than like a collection of disconnected cards.

---

# 2. Global Experience

## 2.1 Full-width layout

The landing page uses the entire viewport width.

```text
100vw
```

Sections should generally be designed to occupy the full available width.

Avoid narrow centered website layouts where the platform feels like a conventional school website.

---

## 2.2 Smooth scrolling

Use Lenis for the primary scrolling experience.

Scrolling should feel:

- smooth
- controlled
- responsive
- premium
- natural

Do not introduce excessive scroll-jacking.

The user should always feel that they are controlling the page.

---

## 2.3 Navigation behavior

The navigation initially sits directly over the hero.

There should be:

- no heavy navbar background
- no large navigation container
- no permanent visual obstruction

The navbar should behave as part of the hero.

### Initial state

```text
LOGO / ENGLISH PLATFORM

Courses
Practice
Games
Magazine
AI Tutor

Profile / Menu
```

The navbar is transparent.

---

## 2.4 Scroll-aware navbar

When the user scrolls downward, the navbar may disappear.

When the user scrolls upward, the navbar smoothly reappears.

Recommended behavior:

```text
scroll down
    ↓
navbar moves upward / hides

scroll up
    ↓
navbar slides back into view
```

The transition should be smooth and short.

The navbar should never abruptly appear or disappear.

---

# 3. HERO — FEATURED EXPERIENCE

## Height

```text
90vh
```

## Width

```text
100vw
```

The hero occupies the first 90% of the viewport.

The remaining approximately 10vh belongs to the scroll invitation.

---

# 4. Hero Carousel

The hero is an **automatically rotating featured-content carousel**.

It is not a standard marketing slider.

The purpose is to showcase the most important or newest experiences currently available on the platform.

Possible slides include:

- Weekly English Magazine
- New Educational Game
- AI Tutor
- New Course
- New Lesson
- Major School Announcement
- New Challenge
- Examination / Assessment announcement

---

# 5. Hero Slide 01 — Weekly Magazine

The first slide should preferably showcase the newest issue of the school English magazine.

The magazine should visually dominate the viewport.

## Composition

Display the first two pages of the latest magazine issue.

Conceptually:

```text
┌──────────────────────────────────────────────┐
│                                              │
│              ENGLISH WEEKLY                  │
│                                              │
│       ┌────────────┬────────────┐            │
│       │            │            │            │
│       │   PAGE 01  │   PAGE 02  │            │
│       │            │            │            │
│       │            │            │            │
│       └────────────┴────────────┘            │
│                                              │
│       ISSUE 024                              │
│       [ READ FULL ISSUE ]                    │
│                                              │
└──────────────────────────────────────────────┘
```

The actual magazine artwork should be used rather than generic placeholders.

---

## Magazine animation

The magazine should have subtle physical depth.

The two pages can have:

- slight perspective
- subtle shadow
- slight page separation
- very subtle parallax

Do not make the effect look like a cheap 3D book.

The focus is on the magazine content.

---

## Magazine interaction

When the user hovers over the magazine:

- the spread can slightly move toward the cursor
- perspective can subtly change
- the CTA becomes more prominent

Do not rotate the magazine aggressively.

---

## Magazine CTA

Display:

```text
READ FULL ISSUE →
```

Clicking the CTA navigates to the dedicated magazine page.

Example route:

```text
/magazine
```

or:

```text
/magazine/:issueId
```

---

# 6. Hero Slide Timing

The hero carousel should automatically transition between featured experiences.

Recommended default timing:

```text
10 seconds per slide
```

The user should have enough time to understand the current experience before it changes.

Do not transition immediately after loading.

---

# 7. Hero Slide Transition

The transition should feel like the content is moving through a continuous space.

Avoid:

```text
hard cut
```

Avoid:

```text
basic opacity fade
```

Preferred:

```text
current slide
      ↓
slightly moves / scales
      ↓
next slide enters
      ↓
new content settles
```

The transition should be approximately:

```text
700ms – 1200ms
```

depending on the final animation.

---

# 8. Hero Slide 02 — Educational Game

The second featured slide can showcase a new educational game.

Example:

```text
NEW GAME

GRAMMAR CHALLENGE

Test your grammar.
Beat your score.
Improve your English.

[ PLAY NOW ]
```

The visual area should show the actual game interface or a highly polished preview.

---

## Game interaction

The game preview should have subtle movement.

Possible animations:

- floating interface elements
- score counter animation
- highlighted answer
- question transition
- cursor interaction
- subtle interface movement

Do not turn the hero into a chaotic gaming advertisement.

---

## CTA

Primary CTA:

```text
PLAY NOW →
```

Clicking opens the game.

Example:

```text
/games/grammar
```

---

# 9. Hero Slide 03 — AI Tutor

The AI Tutor can occupy another featured slide.

Example:

```text
MEET YOUR AI TUTOR

Ask questions.
Practice English.
Get instant guidance.

[ START PRACTICING ]
```

The visual should show an actual conversation interface.

Example:

```text
Student:
Why do we use "had been"?

AI Tutor:
We use it to describe...
```

The interface should appear alive.

Messages can reveal themselves sequentially.

---

## AI animation

Possible behavior:

1. Question appears
2. AI thinking indicator appears
3. Response is generated/revealed
4. Important phrase becomes highlighted
5. Interface settles

The animation should communicate intelligence without pretending to show real-time AI processing if it is only a visual simulation.

---

# 10. Hero Slide 04 — New Course / Lesson

A new course or lesson can occupy the fourth featured slide.

Example:

```text
NEW THIS WEEK

UNIT 04
STORIES & IDEAS

12 lessons
4 practice activities
1 assessment

[ START LESSON ]
```

The visual can show:

- lesson artwork
- course progress
- lesson preview
- vocabulary
- reading content

---

# 11. Hero Carousel Controls

The carousel should have a subtle progress indicator.

Example:

```text
01 ━━━━━━━━━
02 ━━━━━
03 ━━━━━
04 ━━━━━
```

The active slide has a longer progress indicator.

The progress indicator should visually communicate how long remains before the next automatic transition.

---

## Manual navigation

Users should be able to manually change slides.

Possible controls:

```text
01
02
03
04
```

or:

```text
←     →
```

Manual interaction should pause automatic rotation temporarily.

After user inactivity, automatic rotation can resume.

---

# 12. Hero — Scroll Invitation

The bottom approximately 10vh of the first viewport is dedicated to a scroll invitation.

It should visually connect the hero to the rest of the page.

Example:

```text
                    ↓
```

or:

```text
EXPLORE THE PLATFORM

                    ↓
```

---

## Arrow animation

The arrow should continuously move vertically by a very small amount.

Example:

```text
↓
```

moves approximately:

```text
6–12px
```

downward and returns.

Use smooth easing.

The animation should never feel like a bouncing advertisement.

---

## On scroll

Once the user begins scrolling:

- arrow fades out
- hero content begins transitioning away
- next section enters the viewport

The arrow should not remain visible after the user has clearly begun exploring.

---

# 13. SECTION 02 — PLATFORM INTRODUCTION

After the hero, introduce the entire learning platform.

Large statement:

```text
EVERYTHING YOU NEED
TO MASTER ENGLISH.
```

The section explains that the platform combines:

- learning
- practice
- assessment
- assignments
- AI
- games
- progress
- magazine content

---

## Animation

As the section enters:

1. headline reveals
2. supporting text appears
3. platform elements gradually appear
4. visual system establishes the next section

Use controlled staggered animation.

Do not animate every element independently.

---

# 14. SECTION 03 — COURSES & LESSONS

Heading:

```text
LEARN
WITH PURPOSE.
```

This section introduces the structured learning system.

Show:

- courses
- units
- lessons
- lesson completion
- learning content

The section should visually communicate progression.

Example:

```text
COURSE

UNIT 04

Stories & Ideas

12 LESSONS
03 PRACTICE SETS
01 ASSESSMENT
```

---

## Interaction

Course content can move horizontally while the user scrolls vertically.

The user should feel like they are moving through the course structure.

Avoid turning this into a standard card grid.

---

# 15. SECTION 04 — SKILLS PRACTICE

Heading:

```text
PRACTICE
UNTIL IT CLICKS.
```

Introduce the four primary English skills:

```text
READING
WRITING
LISTENING
SPEAKING
```

Each skill should have its own visual identity.

---

## Interaction

Hovering a skill should activate its visual.

Examples:

### Reading

Text / article visualization.

### Writing

Animated writing interface.

### Listening

Waveform / audio visualization.

### Speaking

Voice / conversation visualization.

The interaction should remain lightweight.

---

# 16. SECTION 05 — TESTS & QUIZZES

Heading:

```text
KNOW WHERE
YOU STAND.
```

Introduce the assessment system.

Show:

- quizzes
- tests
- assessment results
- skill breakdowns
- completed assessments

Example:

```text
READING       82%
WRITING       74%
LISTENING     89%
SPEAKING      71%
```

---

## Animation

Numbers should animate into their final values.

Progress bars should fill when entering the viewport.

The animation should happen once per page entry rather than repeatedly.

---

# 17. SECTION 06 — ASSIGNMENTS

Heading:

```text
PUT ENGLISH
TO WORK.
```

Show the assignment system.

Example:

```text
ASSIGNMENT 04

WRITE A NEWS ARTICLE

DUE THURSDAY

82% COMPLETE

[ OPEN ASSIGNMENT ]
```

The section should communicate that assignments are practical learning activities.

---

## Interaction

Hovering an assignment can reveal:

- deadline
- status
- completion
- feedback

Keep the interaction simple.

---

# 18. SECTION 07 — AI TUTOR

This should be one of the largest sections on the landing page.

Heading:

```text
YOUR
AI TUTOR.
```

Supporting message:

```text
Ask questions.
Practice.
Get guidance.
Keep learning.
```

The center of the section contains a large AI Tutor conversation interface.

---

## AI conversation animation

Example sequence:

```text
Student message appears
        ↓
AI thinking state
        ↓
AI response appears
        ↓
important phrase highlights
        ↓
next example appears
```

The interface should feel interactive.

If the actual AI Tutor is available, the landing page can provide a real entry point.

---

## CTA

```text
TRY THE AI TUTOR →
```

---

# 19. SECTION 08 — EDUCATIONAL GAMES

Heading:

```text
LEARN.
PLAY.
REPEAT.
```

Introduce the platform's educational games.

Show multiple games through a horizontally moving experience.

Example:

```text
GRAMMAR CHALLENGE
WORD HUNT
VOCABULARY RUSH
LISTENING QUEST
```

---

## Interaction

Games should feel more energetic than the educational sections.

Possible effects:

- score counters
- question transitions
- interactive buttons
- animated game previews
- subtle motion

Avoid excessive particle effects or distracting animations.

---

# 20. SECTION 09 — WEEKLY ENGLISH MAGAZINE

Heading:

```text
THE ENGLISH
WEEKLY.
```

Show the latest magazine issue.

This section should provide a larger version of the magazine preview introduced in the hero.

---

## Magazine experience

Display two pages simultaneously.

As the user scrolls:

```text
spread 01
    ↓
spread 02
    ↓
spread 03
    ↓
spread 04
```

The transition should feel like moving through a digital magazine.

---

## CTA

```text
READ THE FULL ISSUE →
```

This opens the dedicated magazine reader.

---

# 21. SECTION 10 — ANNOUNCEMENTS & COMMUNICATION

Heading:

```text
WHAT'S
HAPPENING.
```

Display recent platform announcements.

Examples:

```text
NEW GAME
Grammar Challenge is now available.

MAGAZINE
Issue 24 is now live.

AI TUTOR
New speaking practice has been added.

COURSE
Unit 04 is now available.
```

Keep the list short.

The homepage should not become a notification center.

---

## Animation

Announcements enter sequentially as the section becomes visible.

Newer announcements should receive slightly more visual emphasis.

---

# 22. SECTION 11 — STUDENT PROGRESS

Heading:

```text
YOUR
JOURNEY.
```

This section becomes personalized when the student is logged in.

Show:

- course completion
- completed lessons
- completed assignments
- assessment results
- current streak
- skills progress

Example:

```text
72%

COURSE COMPLETION

7 LESSONS COMPLETED
3 ASSIGNMENTS
2 TESTS
4 DAY STREAK
```

---

## Progress visualization

Use a journey/path visualization rather than a dashboard grid.

Example:

```text
START
  │
  ● UNIT 01
  │
  ● UNIT 02
  │
  ● UNIT 03
  │
  ● YOU ARE HERE
```

The student's current position should be visually obvious.

---

# 23. SECTION 12 — FINAL CTA

The final section should become visually quieter.

Heading:

```text
WHERE WILL
ENGLISH TAKE YOU?
```

Primary CTA:

```text
CONTINUE LEARNING →
```

If the student is not logged in:

```text
START YOUR JOURNEY →
```

The section should not feel like an advertisement.

It should feel like the natural conclusion of the experience.

---

# 24. FOOTER

The footer should be minimal.

Include:

```text
ENGLISH PLATFORM

Courses
Lessons
Practice
Tests
Assignments
AI Tutor
Games
Magazine

Support
Privacy
Terms

© 2026 School
```

No unnecessary visual complexity.

---

# 25. Global Animation Rules

The landing page should have a consistent motion language.

## Scroll animations

Use scroll-triggered animations for:

- section introductions
- text reveals
- progress visualization
- magazine movement
- course progression
- game previews

---

## Text animation

Large headings can use:

- mask reveals
- vertical movement
- slight opacity transitions

Avoid excessive character-by-character animations.

---

## Image animation

Images should generally use:

- subtle scale
- slight parallax
- controlled movement

Avoid aggressive zooming.

---

## Hover animation

Hover interactions should be:

- fast
- responsive
- subtle

Typical duration:

```text
200ms – 400ms
```

---

## Section transitions

Sections should visually connect to one another.

Avoid every section having:

```text
fade in
fade out
```

Instead use different transition types where appropriate:

```text
Hero
→ carousel movement

Courses
→ horizontal progression

Skills
→ hover interaction

Tests
→ data animation

AI
→ interface conversation

Games
→ interactive motion

Magazine
→ page movement

Progress
→ journey progression
```

---

# 26. Responsive Behavior

The desktop experience should be the reference experience.

However, the layout must adapt for tablet and mobile.

The 90vh hero concept can remain, but the composition should change.

On mobile:

- magazine pages can become stacked or swipeable
- hero content remains readable
- carousel controls remain accessible
- CTA remains visible
- arrow remains at the bottom
- horizontal desktop experiences become vertical/swipe interactions

Do not simply shrink the desktop design.

The mobile experience should be intentionally redesigned.

---

# 27. Accessibility & User Control

Animations must not prevent normal navigation.

Provide:

- keyboard-accessible controls
- visible focus states
- accessible carousel controls
- pause capability for automatic carousel where appropriate
- reduced-motion support

If the user has reduced motion enabled, replace major movement with simpler opacity/position transitions.

---

# 28. Final Landing Page Structure

The final homepage order is:

```text
01  HERO / FEATURED CAROUSEL
        ├── Weekly Magazine
        ├── Educational Game
        ├── AI Tutor
        ├── New Course / Lesson
        └── Major Announcement

02  PLATFORM INTRODUCTION

03  COURSES & LESSONS

04  SKILLS PRACTICE

05  TESTS & QUIZZES

06  ASSIGNMENTS

07  AI TUTOR

08  EDUCATIONAL GAMES

09  WEEKLY ENGLISH MAGAZINE

10  ANNOUNCEMENTS / COMMUNICATION

11  STUDENT PROGRESS

12  FINAL CTA

13  FOOTER
```

---

# 29. Core Experience Principle

The landing page should feel like one continuous experience.

The user should move through:

```text
WHAT'S NEW
     ↓
WHAT CAN I DO?
     ↓
HOW CAN I LEARN?
     ↓
HOW CAN I PRACTICE?
     ↓
HOW CAN I TEST MYSELF?
     ↓
HOW CAN AI HELP ME?
     ↓
HOW CAN I PLAY?
     ↓
WHAT'S HAPPENING?
     ↓
HOW AM I PROGRESSING?
     ↓
WHAT'S NEXT?
```

The page should never feel like a collection of unrelated LMS modules.

It should feel like a **single interactive English-learning world**.
first page is this <a href="https://ibb.co/LXGkZtr6"><img src="https://i.ibb.co/LXGkZtr6/magazine-1.png" alt="magazine-1" border="0"></a> seoncd page is this <a href="https://ibb.co/Z1vKngsH"><img src="https://i.ibb.co/Z1vKngsH/magazine-2.png" alt="magazine-2" border="0"></a>