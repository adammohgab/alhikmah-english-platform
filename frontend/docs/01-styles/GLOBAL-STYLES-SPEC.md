# GLOBAL STYLES SPEC (v1 DRAFT)

Status: DRAFT v1. This is the single source of truth for how the whole platform looks, moves and sounds. It applies to the public pages, the Student app, the Teacher app and the Admin app.
Companion files: 02-public/SHARED-SPEC.md, 03-student/STUDENT-SPEC.md, 04-teacher/TEACHER-SPEC.md, 05-admin/ADMIN-SPEC.md, 06-tasks/EXECUTION-PLAN.md.
Rule for this file: pure text. No images. Small code blocks are allowed only to pin down token names and integration order.

---

## 0. WHAT THIS REPLACES (READ FIRST)

1. frontend/docs/02-design-system/colors.md, design-system.md, and frontend/docs/00-overview/principles-and-non-goals.md describe an institutional, restrained system (navy and gold, serif headings, flat surfaces, no gradients, no emoji, radius capped at 12 px, almost no animation). This spec REPLACES them completely. Those files must be rewritten or deleted so that nobody follows two systems.
2. Section 2 (Design system) and the "calm" and "sober" tone notes in STUDENT-SPEC, TEACHER-SPEC (section 2), ADMIN-SPEC (section 2) and SHARED-SPEC (section 2) are REPLACED by this file. The earlier violet and coral palette, the "Bricolage Grotesque" and "Figtree" pairing, the "one orchestrated animation" rule and the "flat by default" depth rule are all superseded. Component names, page layouts, flows and behaviors in those specs remain valid.
3. Stack correction. The existing project in frontend/ is Vite + React 18 + React Router v6 + Tailwind CSS 3.4 + TypeScript, with GSAP and Lenis already installed. It is NOT Next.js. The execution plan and every spec line that says "Next.js" or "app/..." paths must be read as the Vite project's page-alone structure (src/pages/<page>/, src/shared/...). The plan will be corrected.
4. The existing landing page in frontend/src/pages/landing is a mock. Its styles are ignored. Its hooks (useLenis, useInView, usePrefersReducedMotion, useScrollNavbar) may be reused if they fit.

---

## 1. LOCKED DECISIONS (from the owner)

- Direction: MAXIMAL, FUN, SMOOTH, INTERACTIVE, with a lot of animation. Not minimal. Not a "premium clean" look.
- Visual personality: chunky playful. Thick ink outlines, hard offset shadows, a sticker feel.
- Color: candy multi-color. Two layers of "color worlds": one world per SKILL (vocabulary, grammar, reading, writing, listening, translation) and one world per AREA (Learn, Play, AI, Rewards, Teacher tools, Admin tools).
- The main theme is LIGHT. The whole page background takes a pastel tint of the current color world. Dark surfaces are allowed only for: game play screens, the AI Tutor chat, shop theme previews and reward reveals, and the footer and marquee bands.
- Typography: chunky rounded display type with a clean body font.
- Shapes: mixed (pills, blobs, notched or cut corners, circles, tickets, bursts), chosen per element.
- Decoration: grain texture, halftone dots and patterns, hand-drawn squiggles, underlines and arrows, peel-off stickers and badges with slight rotation, confetti and particles, marquee text bands, and more creative things in the same spirit.
- Characters: no persistent mascot. At most two characters, used only at key moments (see section 11).
- Emoji: the least amount possible (see section 12).
- Icons: Lucide for UI controls; illustrated sticker icons for skills, rewards and big moments.
- Motion stack: Lenis (smooth scroll everywhere), GSAP (+ ScrollTrigger and friends), Motion (Framer Motion), Rive (and Lottie when needed), Howler.js, canvas-confetti, and Three.js / react-three-fiber for a few 3D moments with a strict performance budget.
- Interaction layers: page transitions (route wipes and morphs), scroll-driven storytelling (pinned sections, parallax, scrubbed animation), cursor effects (magnetic buttons, tilt cards, custom cursor), sound effects, and more.
- Same maximal energy on every screen and every role.
- Sound is ON by default at a low volume. A mute toggle is always visible.
- Purchasable themes are a FULL re-skin: palette, backgrounds, patterns, decoration and skill colors all change.
- Devices: modern phones and laptops, target 60 fps. Performance must not be sacrificed for 3D or effects.
- Interface language is English. Arabic appears only inside the Translation tool.

---

## 2. DESIGN THESIS: THE STICKER BOOK ARCADE

Maximal does not mean random. The look is a SYSTEM with strict rules that are applied everywhere, so the energy reads as design and not as noise.

The five rules that make it one product:
1. Everything that is an object has an INK OUTLINE and a HARD OFFSET SHADOW. Cards, buttons, inputs, chips, avatars, dialogs, charts. The outline is what defines a boundary, never a fill color alone.
2. Everything is a STICKER. Surfaces sit on the page as stickers: they lift on hover, press down on click, and can be peeled, rotated slightly and slapped on.
3. COLOR WORLDS carry meaning. The page, header and active controls take the color of the area or skill you are in. Moving between areas morphs the world.
4. ONE LOUD THING per region. In any viewport area there is one dominant moment (a giant headline, a hero sticker, a big number). Everything around it supports it. This is how maximal stays legible.
5. EVERYTHING RESPONDS. Every interactive element reacts to hover, focus, press and success with motion and, where useful, sound. Nothing is dead.

The memorable thing: the WORLD MORPH. As the student moves through the product (or scrolls through a long page), the page tint, outlines' accents, decorations and the shape of the transition change world. It feels like walking through rooms of one toy.

### 2.1 Anti-slop checklist (reviewers use this)
A screen fails review if any of these is true:
- All cards are identical rounded rectangles in a uniform grid with uniform shadows.
- It uses a purple-to-blue (or any) decorative gradient wash, glassmorphism or blurred frosted panels.
- Everything is the same size, so nothing is loud.
- Decoration is random confetti not tied to a meaning, or decoration sits behind body text.
- Animation is the same fade-up on every element.
- Colors are used outside their world (a random pink on a Learn page with no reason).
- Outlines or shadows are missing or inconsistent on some objects.
- Content is filler ("Item 1", lorem). Mock content must be realistic school content.
- It looks like a component library default with a chunky skin on top.

### 2.2 What survives from the old docs
Realistic content in every mock. No component is reinvented per page (everything comes from the shared kit). Logical CSS properties are welcome but not required. Everything else from the old design docs is replaced.

---

## 3. COLOR SYSTEM

### 3.1 Core neutrals
- ink: #1A1530. All outlines, all body text on light surfaces, hard shadows (default).
- ink-2: #4A4566. Secondary text.
- surface: #FFFFFF. The surface of cards, inputs and panels (the "sticker paper").
- night-900: #14112A, night-800: #1D1940, night-700: #2A2558. Dark surfaces (section 3.5).
- night-text: #F6F3FF. Text on night surfaces. night-shadow: #0B0919.
Contrast: ink on surface is 17.6 to 1. night-text on night-900 is 16.8 to 1.

### 3.2 The twelve color worlds
Every world has five tokens:
- main: the saturated candy color. Fills of buttons, bars, tiles, hero blocks. ALWAYS used with ink text and an ink outline.
- tint: the pastel page background and large soft areas.
- soft: a mid pastel for panels, chips, hover and selected states.
- pop: a contrasting accent used sparingly for stickers, sparks, highlights and notification dots.
- deep: a dark readable shade of the hue for text on tint or soft, links and icons on tint. Never used as a big fill.

| World | Layer | main | tint | soft | pop | deep |
|---|---|---|---|---|---|---|
| Vocabulary (Bubblegum) | skill | #FF6FA5 | #FFEDF4 | #FFC7DC | #FFD93D | #9B1B52 |
| Grammar (Blueberry) | skill | #7C8CFF | #ECEEFF | #C9CFFF | #FFB84D | #2B3499 |
| Reading (Sky) | skill | #4DB8FF | #E8F6FF | #BCE4FF | #FF7A59 | #0B5C99 |
| Writing (Tangerine) | skill | #FF9A3D | #FFF1E3 | #FFD3A6 | #2FD6A3 | #8F4300 |
| Listening (Mint) | skill | #35DCA8 | #E6FBF3 | #B5F0DA | #FF6FA5 | #0B6B4B |
| Translation (Lime) | skill | #B6E83C | #F4FBDD | #DDF39A | #9B7BFF | #4A6600 |
| Learn (Sunshine) | area | #FFD23F | #FFF8DB | #FFEA94 | #4DB8FF | #6E5200 |
| Play (Tomato) | area | #FF5A4F | #FFECE9 | #FFC4BE | #FFD23F | #A3150C |
| AI (Aqua) | area | #26D0E0 | #E3FAFC | #AEEFF5 | #FF6FA5 | #0A6670 |
| Rewards (Orchid) | area | #D26BFF | #F9EBFF | #EBC2FF | #FFD23F | #7A1AA8 |
| Teacher tools (Fern) | area | #5FD068 | #E9F9EA | #BFEEC2 | #FF6FA5 | #1B6A24 |
| Admin tools (Cocoa) | area | #C98E5E | #F8EFE7 | #E8CDB5 | #4DB8FF | #6B3E1D |

Verified contrast (computed): ink on every `main` is at least 5.7 to 1; ink on every `tint` and `soft` is at least 11.5 to 1; `deep` on `tint` is at least 6.0 to 1 and on `soft` at least 5.1 to 1. On night-900, every `main` is at least 6.0 to 1 and every `pop` at least 5.8 to 1.
Important consequence: `main` colors are saturated mid-tones and do NOT reach 3 to 1 against white by themselves. Therefore a fill is never the only boundary. The ink outline always provides the boundary, and text on a `main` fill is always ink.

### 3.3 Semantic colors (status only, always with a shape and a label)
| Meaning | Fill | Text on tint or white | Tint |
|---|---|---|---|
| Success / correct | #1FBF7A (ink text 7.4 to 1) | #0B6B45 | #E3F8EE |
| Danger / wrong / overdue | #F2566A (ink text 5.3 to 1) | #B3162D | #FFE9EC |
| Warning / attention | #FFB020 (ink text 9.6 to 1) | #7A5200 | #FFF3D6 |
| Info | the Reading world (main #4DB8FF) | #0B5C99 | #E8F6FF |
Status is shape-coded as well as color-coded: success is a round sticker with a check, danger is a jagged-edge (zigzag) sticker with an exclamation or cross, warning is a triangle-notched sticker, info is a speech-bubble sticker. Each status also carries a text label, never color alone.

### 3.4 How worlds are applied (precedence)
1. SKILL WORLD wins inside skill content: the Vocabulary, Grammar, Reading, Writing and Translation tool pages (ST-15 to ST-19) take their skill world for page tint and header. Listening content (listening questions, audio blocks) takes Listening. Skill chips, skill bars and skill icons use their skill world everywhere in the product.
2. AREA WORLD applies to everything else by area:
   - Learn: dashboard, courses, units, lessons, activities, quizzes, assignments, certificates, profile, settings, notifications.
   - Play: the games selection page and game result pages (the game PLAY screens use night surfaces with the Play world as the glow).
   - AI: the AI Tutor (night surfaces with the AI world as the glow) and AI-related teacher and admin tools.
   - Rewards: quests, leaderboard, achievements, shop.
   - Teacher tools: all pages under the Teacher app, except pages that sit inside a skill context.
   - Admin tools: all pages under the Admin app.
   - Public pages: each landing section chooses its own world (the landing page IS the world tour).
3. Components set their own accent from the CURRENT world through CSS variables. Skill chips always use the skill's own world regardless of page.
4. A page may override its world in its page spec (for example a certificate uses Rewards).

Each page sets `data-world` on its root element. The world variables below read from it.

### 3.5 Dark surfaces ("Night")
Allowed ONLY on: game play screens, AI Tutor chat, shop theme previews and reward reveals (the "stage"), footer, marquee bands.
- Backgrounds night-900 with panels night-800 and raised parts night-700. Text night-text. Never pure black.
- Outlines on night are the current world's `soft` or paper white, 3 px, so the chunky look carries over. Hard shadows on night use night-shadow.
- Accents on night use the world's `main` and `pop`, including glow (a blurred duplicate behind a shape, only on high effects tier).
- A night surface meets a light page through a notched, scalloped or wavy edge shape (a "torn paper" divider), never a hard straight cut and never a gradient fade.

### 3.6 Gradients and shine (rule)
Default is flat color plus halftone and grain. Allowed exceptions: the world morph (animated between two worlds), highlight shine on 3D-like objects (coins, trophies, chests), data heat maps, and the sheen on tilting cards. No decorative gradient washes, gradient text or gradient buttons.

### 3.7 CSS variables (names are fixed)
```
:root {
  --ink: 26 21 48;            /* stored as RGB channels so Tailwind alpha works */
  --ink-2: 74 69 102;
  --surface: 255 255 255;
  --night-900: 20 17 42; --night-800: 29 25 64; --night-700: 42 37 88;
  --night-text: 246 243 255; --night-shadow: 11 9 25;
  --success: 31 191 122; --success-text: 11 107 69; --success-tint: 227 248 238;
  --danger: 242 86 106;  --danger-text: 179 22 45;  --danger-tint: 255 233 236;
  --warning: 255 176 32; --warning-text: 122 82 0;  --warning-tint: 255 243 214;
}
/* each world defines five channels: --w-<name>-main, -tint, -soft, -pop, -deep */
[data-world="learn"] {
  --world-main: var(--w-learn-main);  --world-tint: var(--w-learn-tint);
  --world-soft: var(--w-learn-soft);  --world-pop:  var(--w-learn-pop);
  --world-deep: var(--w-learn-deep);
}
/* Tailwind (v3.4) colors map to rgb(var(--world-main) / <alpha-value>) etc. */
```
World names: vocabulary, grammar, reading, writing, listening, translation, learn, play, ai, rewards, teacher, admin.
The page background is `rgb(var(--world-tint))`. The world morph animates these variables (GSAP tweens the variables, 600 ms, "power2.inOut").

---

## 4. THEMES (THE FULL RE-SKIN)

The 12 worlds above are the DEFAULT theme ("Candy Pop"). A theme is a complete replacement set:
- For each of the 12 worlds, the five tokens (main, tint, soft, pop, deep), so skill colors and area colors all change.
- ink and surface values (an exotic theme can warm or cool the ink and the paper).
- Night values for dark surfaces.
- Page background treatment (flat tint plus pattern choice: halftone, dots, stripes, waves, grid, stars).
- Grain strength and tint.
- Decoration pack: the sticker set, squiggle style, confetti shapes and marquee separators.
- Shape bias (for example one theme leans blobby, another leans notched), within the shape system.
- Name, rarity, price, and preview art.
Rules:
- Every theme must meet the same contrast thresholds as section 3.2 for all 12 worlds (ink on main at least 4.5 to 1; deep on tint and soft at least 4.5 to 1; text on night at least 7 to 1). The Themes studio (AD-18) checks this and blocks publishing on failure.
- Themes are single-mode light themes, EXCEPT optional themes marked "Night theme" whose page backgrounds are night surfaces. The default and the free starters are light. (Assumption, see section 17.)
- Free starters: "Candy Pop" (default) and "Sorbet" (the same system with softer, more pastel mains). Purchasable themes are exotic and colorful.
- Applying a theme sets all variables at once with a world-morph tween (about 600 ms), no reload.
- Sound, cursor and page transition styles are NOT part of a theme in v1 (they are global). They can be added to the theme definition later without changing the architecture.

---

## 5. TYPOGRAPHY

### 5.1 Families
- Display: Fredoka (variable, rounded, chunky; weights 500 to 700). Headlines, big numbers, sticker text, buttons labels, tab labels.
- Body and UI: Figtree (clean, friendly). Paragraphs, table cells, form text, captions.
- Hand note (decorative only): Caveat. Short scribbled notes next to arrows, at most 6 words, never for information the user must read.
- Arabic (Translation tool only): IBM Plex Sans Arabic for body, Baloo Bhaijaan 2 for large Arabic headings in the tool.
Fallbacks: display "Fredoka, 'Baloo 2', 'Arial Rounded MT Bold', system-ui, sans-serif"; body "Figtree, system-ui, sans-serif".
Fonts are self-hosted with `font-display: swap`, subset to Latin, preloaded for the display font.

### 5.2 Scale (fluid)
| Token | Size | Line height | Weight and family | Use |
|---|---|---|---|---|
| display-xl | clamp(56px, 9vw, 140px) | 0.95 | Fredoka 700, tracking -0.02em | Landing hero, celebration titles |
| display-lg | clamp(44px, 6vw, 96px) | 1.0 | Fredoka 700 | Section openers, big stats |
| h1 | clamp(36px, 4.2vw, 64px) | 1.05 | Fredoka 700 | Page titles |
| h2 | clamp(28px, 3vw, 44px) | 1.1 | Fredoka 600 | Section titles |
| h3 | 24px | 1.2 | Fredoka 600 | Card titles |
| h4 | 20px | 1.25 | Fredoka 600 | Subsections |
| body-lg | 18px | 28px | Figtree 500 | Lessons, intros |
| body | 16px | 24px | Figtree 500 | Default text |
| body-sm | 14px | 20px | Figtree 500 | Table cells, secondary |
| caption | 12px | 16px | Figtree 600 | Captions, helper text |
| label | 13px | 16px | Figtree 700, sentence case | Chips, field labels (NOT uppercase) |
| number | tabular figures, Figtree 700 | | | Stats in dense UI; display numbers use Fredoka |

### 5.3 Typographic effects (each has one job)
- Sticker text: display text with a 3 to 4 px ink text-stroke (paint-order stroke fill or an SVG duplicate) and a hard offset shadow in ink or in the world's `deep`. ONLY on display sizes: hero, section openers, celebrations. Never on body, data or buttons.
- Highlighter: a hand-drawn marker swash behind a key word (SVG, world `soft` or `pop`). At most ONE highlighted word per section. Vary the technique across the page (highlighter, squiggle underline, circled scribble, boxed sticker). Do not accent a word in every headline.
- Split reveals: display text enters by characters or words with stagger and overshoot (section 8). Only when scrolled into view the first time.
- Marquee text: section 12.
- Reading text (lessons, passages, feedback) is always Figtree body-lg on a white surface, max width 70 characters, ink on surface. Display styles never apply to reading text.
- Minimum text size 12 px. Body copy never below 16 px except tables (14 px).

---

## 6. SHAPE, OUTLINE, SHADOW AND SPACING

### 6.1 Outline and shadow tokens
- stroke-1: 2 px (inputs, chips, dense table container, small stickers).
- stroke-2: 3 px (cards, buttons, panels, dialogs). The default.
- stroke-3: 4 px (hero stickers, large display blocks, celebrations).
- Hairline: 1 px at 12 percent ink. Allowed ONLY inside dense data (table row dividers, chart grids) where heavy outlines would hurt reading.
- Shadow tokens (hard, no blur): shadow-xs 2 px 2 px 0, shadow-sm 3 px 3 px 0, shadow-md 5 px 5 px 0, shadow-lg 8 px 8 px 0, shadow-xl 12 px 12 px 0. The direction is always down and to the right. Color is ink by default; large tinted panels may use the world `deep`; on night surfaces night-shadow.
- Pressed state: shadow becomes 0 and the element translates by the same offset (it "sinks into the page").
- Shadows are implemented so they animate smoothly without repainting: use a pseudo-element shadow shape that is moved with transform; do not animate box-shadow.

### 6.2 Shape vocabulary (named shapes)
- pill: radius 999 px.
- squircle: radius 24 px (cards), 32 px (dialogs and large panels).
- blob: an organic radius shape (for example 63% 37% 54% 46% / 55% 48% 52% 45%); three or four preset blobs; some may slowly morph (decorative only).
- notch: a rectangle with cut corners (clip polygons of 10 to 16 px diagonals), top-left and bottom-right by default.
- ticket: sides scalloped by circular cut-outs (radial masks); used for quests, coupons, certificates, deadlines.
- burst: a 10 to 14 point starburst (badges, "new", XP gains, correct answers).
- zigzag: jagged edge (wrong answers, errors).
- tab: rounded top corners only (folder tabs, sticky headers).
- speech bubble: rounded body with a tail (tooltips, chat bubbles, status info).
- circle.

Assignment by element (defaults, can be overridden by a page spec):
| Element | Shape |
|---|---|
| Primary button | pill, or notch for the "play" and "start" buttons |
| Secondary button | pill with white fill |
| Input and select | rounded rectangle radius 14 px, stroke-2 |
| Card (content) | squircle 24 px; mix with ticket and notch variants for variety |
| Chip and tag | pill |
| Badge and level medallion | burst or circle |
| Avatar | circle or blob (the frame decides) |
| Progress track | pill with stripes inside |
| Dialog | squircle 32 px with a tab header sticker |
| Tooltip and chat bubble | speech bubble |
| Toast | notch sticker with a tail-less slide |
| Table container | rounded rectangle radius 18 px, stroke-1 or stroke-2 |
| Tab | tab shape (folder style) |

Variety rule: in any grid of three or more cards, use at least two different shapes or rotations (for example alternating ticket and squircle, or one card rotated by 1.5 degrees), but the SAME outline, shadow and type rules.

### 6.3 How non-rectangular shapes keep outlines
clip-path removes outlines and shadows. Therefore all non-rectangular shapes are built with the ShapeFrame technique: an outer layer (ink, larger by the stroke width) and an inner layer (the fill), both clipped with the same path, plus a shadow layer offset by the shadow token. The shadow layer is a separate element that moves with transform. SVG outline paths are used for complex shapes (blob, burst, ticket). ShapeFrame is a shared component (task in the plan); no page implements its own.

### 6.4 Rotation and stickers
- Stickers (decorative or informational) rotate between -6 and +6 degrees. Content cards rotate at most 1.5 degrees and only in marketing or celebration contexts and in the student dashboard. Tables, forms and builders never rotate.
- A sticker can be "peeled": on hover the corner curls (a clip and a small shadow), on click it lifts and moves.
- At most 2 rotated stickers in any single viewport region, and none overlapping text that must be read.

### 6.5 Spacing and layout
- 4 px base unit. Steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 120.
- Sections on public and dashboard pages are full-bleed bands in world colors; content sits in a container up to 1280 px (1440 px for data-heavy teacher and admin pages).
- Collage layouts are allowed: negative margins, overlapping stickers, elements bleeding off the edge. Overlaps never hide text or controls.
- Gutters 24 px desktop, 16 px mobile. Breakpoints: 640, 768, 1024, 1280, 1536.
- Page sections end and begin with shaped dividers (wavy, scalloped, zigzag, notched) rather than straight lines.

---

## 7. TEXTURE AND DECORATION KIT

Everything below is aria-hidden and has pointer-events none unless it is a designed interaction.

- Grain: a small tile (about 160 px) of noise as a pre-multiplied PNG or an SVG turbulence, 5 to 8 percent opacity, fixed over the page. No blend modes (they are expensive). Disabled on the low effects tier.
- Halftone: dot patterns (sizes small, medium, large) and stripe, wave, grid and star patterns in the world `deep` at 8 to 14 percent over `tint` or `soft`. Used for section backgrounds, skeletons and progress stripes.
- Squiggles: a set of hand-drawn SVG strokes (underline, wavy underline, loop arrow, curved arrow, circle scribble, zigzag, spark lines, bracket). They DRAW themselves (stroke-dashoffset) when first shown.
- Stickers: the illustrated sticker pack (stars, bursts, hearts, lightning, pencil, book, speech bubbles, trophy, coin, flame, key, cap, paper plane, magnifier, headphones, globe, puzzle, medal, sprout, rocket), each in the 12 world colors. Used for skills, rewards, empty states and big moments.
- Confetti and particles: shapes (circle, squiggle, star, triangle, ribbon) in the world and theme colors, via canvas-confetti. Sparkle trails on XP bars and coins.
- Marquee bands: a horizontal scrolling band of short phrases separated by sticker shapes. Rules: speed 40 to 80 px per second plus a boost from scroll velocity (Lenis), pauses on hover and on keyboard focus, stops under reduced motion and when "Effects: Off" is chosen, at most 2 bands per page, text 40 to 96 px in Fredoka, a night or `main` background, content from the product ("Learn", "Play", "Level up", unit names). A visible pause control exists on any band that is on screen for more than 5 seconds (accessibility).
- Decoration budget (for performance and legibility): at most 12 animated decorative elements on screen at once; at most 2 decorative stickers and 1 pattern per viewport region; none behind body text; floating decorations drift slowly and pause when off screen.

---

## 8. MOTION SYSTEM

### 8.1 Who owns what (to avoid libraries fighting)
| Library | Owns | Never |
|---|---|---|
| Lenis | Smooth scrolling for the whole document; scroll velocity | Animating anything except scroll |
| GSAP (core, ScrollTrigger, Flip, SplitText) | Scroll-linked and scrubbed animation, pinned sections, page-level timelines, the world morph, page transition timelines, text splits, Flip shared-element moves, marquee | Component mount and unmount animation |
| Motion (Framer Motion) | Component enter and exit (AnimatePresence), layout animation, gestures (hover, tap, drag, focus), springs, list reordering | Scroll-linked animation, page transitions timelines |
| CSS (transitions and keyframes) | Simple hover and focus states, small looping decoration, color changes | Anything needing choreography |
| Rive | Characters, the streak flame, animated sticker icons, celebratory state machines | Layout or data-driven UI |
| Lottie | One-shot celebratory animations only when an asset exists and Rive is unsuitable | Looping UI |
| Howler.js | All sound | |
| canvas-confetti | Confetti and particle bursts | |
| Three.js / react-three-fiber | The few 3D moments (section 9) | Ordinary UI |
Rule: one library animates a given property of a given element. If an element is controlled by Motion it is not also tweened by GSAP.

### 8.2 Timing, easing and springs (tokens)
- Durations: instant 90 ms, fast 160 ms, base 280 ms, slow 480 ms, epic 900 ms, page transition 700 ms total.
- GSAP eases: sticker-pop (back.out(1.8)), bounce (elastic.out(1, 0.55)), glide (power3.out), morph (power2.inOut), snap (expo.out).
- Motion springs: snappy (stiffness 520, damping 32), bouncy (stiffness 400, damping 18), gooey (stiffness 200, damping 12), settle (stiffness 260, damping 28).
- Principles: anticipation (a tiny pull back before a move), overshoot (go past and settle), squash and stretch (press scales 0.96 by 1.04; release does the opposite), follow-through (secondary parts lag), stagger (children offset 40 ms, at most 12 children staggered).
- Nothing blocks input. Animations never delay a result the user is waiting for, never disable a control that should be clickable, and can be interrupted by the next input.

### 8.3 Global smooth scroll (Lenis)
- Lenis runs on the whole app (public and all roles). Configuration: duration about 1.1 s with an exponential ease (or lerp 0.1), wheel multiplier 1, touch uses native momentum scrolling (syncTouch off), `autoRaf` off; Lenis is driven from the GSAP ticker so ScrollTrigger and Lenis share one frame loop: `lenis.on("scroll", ScrollTrigger.update)`, `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`.
- Nested scroll areas must opt out so they scroll normally: dialogs, drawers, dropdowns, popovers, chat message lists, tables with their own overflow, builder panels, code or text areas. Mark them with `data-lenis-prevent`.
- When a modal or full-screen reveal opens, call `lenis.stop()`; call `lenis.start()` on close.
- In-page anchors and "back to top" use `lenis.scrollTo`. Route changes reset scroll to top after the page transition (or restore position for back navigation).
- Under reduced motion or Effects: Off, smoothing is disabled (native scroll).
- The existing useLenis hook in the landing mock may be moved to shared and extended; one Lenis instance for the whole app, created in the app shell.

### 8.4 Interaction catalog (every item is a shared behavior, built once)
Buttons
- Hover: lift -2 px and the shadow grows one step. Press: sinks (shadow to 0, translate by the offset, scale 0.97). Release: springs back with overshoot (bouncy).
- Primary success actions fire a small particle burst from the button.
- Large call-to-action buttons are MAGNETIC: inside a radius of 80 px the button leans toward the pointer by up to 12 px. Only on devices with a fine pointer.
Cards and stickers
- TILT: on pointer devices, cards tilt up to 6 degrees toward the pointer with a moving sheen highlight. Corner peel on stickers. Cards in lists lift a step on hover (no tilt in dense lists).
- Draggable stickers (builders, avatar editor, shop preview) lift, rotate toward the drag direction and drop with a settle.
Form controls
- Focus: the outline thickens one step and a ring pulses once. Labels float with a spring. Errors: a short horizontal shake (3 oscillations, 240 ms) and the status icon changes to the zigzag sticker. Success: a green check sticker pops in.
- Switch: gooey morph of the knob; checkbox: sticker pop and the check draws; radio: dot grows with overshoot; select: options cascade in with stagger.
Lists and data
- Lists enter with stagger and overshoot; reordering uses layout animation; deleting collapses with a poof of tiny particles (low effects tier: simple fade).
- Numbers count up with overshoot. Progress bars FILL with a liquid slosh (a wave at the leading edge) and a sparkle trail.
- Table rows in dense tables do NOT animate on hover (a tint only); row enter stagger is limited to the first 12 rows.
Feedback
- Correct answer: green burst sticker pops, answer tile bounces, optional sound. Wrong answer: the tile shakes, a zigzag sticker appears; never humiliating (no red full-screen flash). Streak flame: a Rive state machine (idle, grow, flare). XP gain: "+25 XP" burst floats from the source to the XP chip, which pulses.
Navigation
- Active nav item pops forward (shadow grows, slight rotation of its icon sticker). Tab changes slide a highlighter pill between tabs (Motion layoutId).
- Tooltips pop like speech bubbles with a tiny delay (300 ms) and never cover the target.
Cursor (pointer devices only)
- A custom cursor: a small ink dot plus a trailing blob ring that follows with easing. Over interactive elements the ring grows into a pill with a label ("Open", "Play", "Drag", "Claim"), over text inputs it becomes the system I-beam, and over disabled elements it shrinks. The custom cursor never hides the system cursor inside text inputs, dialogs' scrollbars, or while dragging files. Disabled on touch, under reduced motion and on the low tier. One shared component with a single requestAnimationFrame loop that only changes transforms.
Idle and ambient
- Decorations drift (slow sine movement), stickers wobble every 6 to 10 seconds, the active sticker blinks. All ambient motion pauses when off screen, when the tab is hidden, and on low tier.
Loading
- Skeletons are sticker placeholders with a halftone shimmer. Spinners are bouncing letters or a morphing blob. Route loading is covered by the transition layer.
Haptics (optional)
- Short vibration on supported phones for correct, wrong, claim and level-up. A toggle in Settings.

### 8.5 Scroll-driven storytelling
- Public landing page: up to 3 pinned sections with scrubbed timelines (for example the overview product preview building piece by piece, the curriculum sequence assembling, the games band with horizontal scroll), parallax layers (speeds set by data attributes), text split reveals, marquee speed tied to scroll velocity, a progress rail, and the world morph between sections (each section sets its own world; the page tint tween follows the scroll).
- In-app pages: scroll storytelling is lighter. Page headers have parallax art and shrink into a sticky bar; dashboards animate sections in as they enter (once); long pages (lesson, reports) show a scroll progress sticker. No pinned sections inside the app except the landing and celebration reveals.
- All scroll animation uses ScrollTrigger with Lenis and `scrub` smoothing of 0.5 to 1. Entrance animations run once.

### 8.6 Page transitions (route wipes and morphs)
- Every route change in the app runs a wipe: shutters or shapes in the DESTINATION area's world color sweep across, hide the swap, and reveal the new page. Total 700 ms (350 out, 350 in). The page tint morphs to the new world during the wipe.
- Style per area: Learn = slanted shutters; Play = circle iris; AI = ripple from the clicked point; Rewards = confetti curtain; Teacher tools = notched panels slide; Admin tools = stacked tabs flip; Public = big blob swipe. Skill pages use their skill world's color with the Learn shutter style.
- Shared element morphs (GSAP Flip): a course card becomes the course page header; a badge tile becomes the badge dialog; a shop item becomes the preview stage; the avatar morphs into the profile plate. If the source element is missing, fall back to the wipe.
- Implementation outline (React Router v6): a TransitionOutlet component holds the outgoing page until the exit timeline completes, then mounts the new page and runs the enter timeline (Motion AnimatePresence for mount and unmount, GSAP for the wipe timeline). Navigation requested during a transition cancels it and goes straight to the new target. Back and forward navigation use a shorter wipe (350 ms).
- Not used for: tab changes inside a page, filters, dialogs, drawers. Those use local animation.
- Under reduced motion: a 150 ms crossfade. On low tier: a simple wipe without shared-element morphs.
- Forms and quiz flows: a wipe never interrupts typing or an active attempt; the idle timeout and unsaved-changes guards run before the wipe.

### 8.7 Celebration system
Levels of celebration, triggered by product events:
| Level | Triggers | What happens |
|---|---|---|
| Small | Correct answer, lesson complete, coin earned, quest progress | Burst sticker, small particles, short sound, XP and coin float |
| Medium | Quest claimed, quiz passed, badge earned, streak day | Sticker burst with confetti, bounce, character cameo (optional), sound, toast sticker |
| Large | Level up, rank up, certificate, 7-day or longer streak milestone, perfect quiz, shop reveal of an Epic or Legendary item | Full-screen takeover (night stage), 3D or Rive hero object, confetti shower, big sound, Lenis stopped, skippable |
Rules: celebrations queue; at most one Large per 10 seconds; every celebration is skippable with a click or Escape and never blocks reading results; under reduced motion they become a static sticker and a short fade; on teacher and admin side the same system runs with their own events (a successful publish, approving AI grades, finishing a rollover) at Small and Medium levels.

### 8.8 Sound system
- Howler.js with one audio sprite per category: ui (tap, toggle, open, close, pop), feedback (correct, wrong, claim, coin, xp, level-up, badge, streak, error), celebration (confetti, fanfare, reveal), games (per game beats and cues).
- Defaults: master volume 0.35, ON by default. A mute button (speaker icon) is ALWAYS visible in the chrome: in the top bar on desktop and in the compact menu on mobile, and inside focused flows (quiz, games, grading) in the slim header. Settings offer master volume and category switches (UI taps, feedback, celebrations, game sounds).
- Browsers block audio before the first user gesture. Audio unlocks on the first pointer or key event; the mute button reflects the real state.
- Sounds are short (under 400 ms except celebrations), normalized, with no hover sounds and no looping ambient music in v1. Rapid repeats are rate-limited (at most 1 tap sound per 80 ms; combos pitch up gradually in games).
- Sound is never the only feedback (visual feedback always exists). Audio respects a hidden tab (muted automatically).
- In teacher and admin pages, UI tap sounds are on by default like everywhere else, with a one-click "Taps off" in the sound menu (see section 17, open question).

### 8.9 Reduced motion and effects tiers
Three tiers, chosen automatically and overridable in Settings ("Effects": Full, Reduced, Minimal):
| Tier | What runs |
|---|---|
| Full | Everything in this spec |
| Reduced | No parallax or scroll scrubbing, no custom cursor, no tilt or magnetic, no confetti showers (single burst), no 3D (replaced by Rive or still), page wipes shortened to 350 ms, marquee slower and paused on interaction, ambient drift off |
| Minimal | Everything static or crossfade: 150 ms fades only, no Lenis smoothing, no particles, no 3D, marquee stopped, sound unchanged |
Automatic selection: `prefers-reduced-motion: reduce` selects Minimal. A runtime quality governor samples frame time: if the average frame takes more than 20 ms for 2 seconds it drops one tier for decorative effects (never below what the user chose as a floor), and shows a small toast "Effects lowered to keep things smooth" once, with an undo. The governor also reads device memory and hardware concurrency at start. Sound is independent of the tier.
Accessibility rules that always hold: no flashing more than 3 times per second; looping or moving content that lasts over 5 seconds has a pause control (marquees and ambient motion); parallax and scroll animation are gentle (small distances); vestibular-heavy effects (full-screen zoom or spin) are only in Large celebrations and are skippable; keyboard focus is never hidden by effects.

---

## 9. 3D MOMENTS AND THE PERFORMANCE BUDGET

3D is allowed in only these places: (1) one accent object in the landing hero, (2) the reward reveal stage (chest, coins, trophy) for Large celebrations and shop reveals, (3) the level-up and certificate takeover, (4) one optional rotating object in the shop theme preview stage. Nothing else.
Rules (non-negotiable):
- Loaded lazily as a separate chunk (dynamic import), never in the initial bundle, and only when the component is about to be visible. Chunk target at most 250 KB gzipped for three, react-three-fiber and helpers combined.
- One WebGL canvas at a time. The canvas mounts when needed and unmounts when done.
- Pixel ratio clamped to between 1 and 1.5 on phones (2 on large desktops), `frameloop="demand"` except while an animation plays, rendering paused when off screen (IntersectionObserver) or the tab is hidden.
- Geometry under 20,000 triangles, no real-time shadows (baked or fake blob shadows), compressed textures (KTX2) or flat-shaded stylized materials that suit the sticker look, no post-processing on the Medium tier and below.
- A runtime fallback: if WebGL is unavailable, the device is on a lower tier, the user chose Reduced or Minimal, or the frame governor trips, show the same moment as a Rive or still sticker animation.
- 3D never starts a layout shift: a reserved box with a sticker placeholder is shown until it is ready.
- Assets (glTF) are stylized to match the chunky look: thick outlines via inverted-hull or a toon shader, flat colors from the current world.

Global performance budgets (measured on a mid-range phone, throttled 4G):
- Largest Contentful Paint at most 2.5 s on public pages; Interaction to Next Paint at most 200 ms; Cumulative Layout Shift at most 0.05.
- JavaScript per route chunk at most 150 KB gzipped, excluding the shared kit and excluding the lazy 3D chunk. The shared animation libraries (Lenis, GSAP core and used plugins, Motion) are in the shared chunk; Rive runtime, Howler, confetti, three are lazy.
- Animate only transform and opacity (and filter sparingly). Never animate width, height, top, left, box-shadow or clip-path on large areas every frame (clip-path morphs are allowed on small shapes). `will-change` is applied only during an animation and removed after.
- No `backdrop-filter`. No blend-mode overlays across the page.
- Audio sprites at most 300 KB total, loaded after first paint.
- Fonts: display font subset about 30 KB, body about 40 KB, preloaded.
- Frame budget: 60 fps target, the governor keeps average frame time under 16.7 ms on Full tier.

---

## 10. COMPONENT STYLING RULES (VISUAL LAW FOR THE SHARED KIT)

Each component in the UI kit follows these rules. Behavior comes from the role specs; Radix primitives provide accessibility and are always styled with this system.
- Button: pill (or notch for Play and Start), stroke-2 ink outline, shadow-sm, display font label. Variants: primary (world main fill, ink text), secondary (white fill), tertiary (world soft fill), ghost (no outline; a squiggle underline draws on hover), danger (danger fill), icon (circle). Sizes: S 36 px, M 44 px, L 56 px, XL 72 px (hero). Disabled: fill becomes soft grey-tint with a dashed outline and no shadow; never an invisible button.
- Input, textarea, select: white fill, stroke-2 ink, radius 14, shadow-xs; focus raises to shadow-sm and thickens the outline; label above in Figtree 700; helper text below; error: danger text and a zigzag sticker with a message.
- Card: white fill, stroke-2, shadow-md, squircle 24; variants flat, ticket, notch, sticker (rotated). Cards on a `tint` page sit on top with a clear contrast.
- Chip and tag: pill, stroke-1, soft fill (skill chips use the skill world soft and an icon).
- Tabs: folder tabs; the active tab is main fill, raised and rotated -1 degree; inactive tabs are soft.
- Dialog: squircle 32, stroke-3, shadow-lg, a sticker tab on top with the title; the backdrop is ink at 40 percent opacity with a halftone pattern (no blur). Opening pops with overshoot.
- Drawer: slides from the side as a large tab with a notched edge.
- Toast: notch sticker, status shape icon, slides in with bounce, auto-dismisses.
- Tooltip: speech bubble, ink fill on light surfaces with surface text, or surface fill on night.
- Progress bar: pill track with stripes, fill with world main and slosh; progress ring: thick ring with round caps and a spark at the head.
- Avatar: circle or blob with a frame sticker (the equipped frame).
- Table (see 10.1), Chart (see 10.2), Skeleton (halftone shimmer), Empty state (a sticker illustration with a character cameo when allowed, one sentence, one button), Error state (zigzag sticker).
- Status stickers: success, danger, warning, info shapes from section 3.3.
- Focus ring: a 4 px ring in ink with a 2 px white gap, plus the world pop color inner dot on buttons; always visible on keyboard focus. It is the same on every element.
- Selection: world soft fill with a thick check sticker.
- Scrollbars: thick pill thumbs with ink outline on desktop (custom styling where supported).

### 10.1 Dense data screens (teacher and admin tables, grading, builders, reports)
The same language with legibility guardrails:
- The table lives in a stroke-2 container with a world main header band (ink text, display font labels in sentence case); rows are white with hairline dividers; zebra is optional and uses `tint`.
- No rotation, tilt, magnetic or hover lift inside tables. Hover is a `soft` row tint only. Selected rows get a `soft` fill and a thick check sticker.
- Row text is Figtree 14 px minimum, numbers tabular. Contrast always at least 4.5 to 1.
- Status cells use shape-coded status stickers.
- Sticky headers and bulk bars keep their sticker style and appear with a bounce.
- Decoration is reduced to the page header, empty states and the sticker tile accents; it never sits between rows.
- Motion in dense screens is fast (durations at most 160 ms for row-level feedback) and never delays showing data.

### 10.2 Charts
- Built with Recharts using custom shapes: bars have ink outlines, rounded caps and hard shadows (shadow-xs); lines are 4 px with round caps and sticker dots; areas are flat world soft fills with halftone; pie and donut use thick outlines and burst labels.
- Series colors come from worlds (skill charts use the skill worlds; mixed charts use area worlds); text labels are always present (never color alone) and every chart has a "View as table" toggle.
- Gridlines are 1 px dotted at 12 percent ink. Axis labels Figtree 12 to 14 px.
- Charts animate in once (bars grow with overshoot, lines draw). Reduced motion shows them static.

---

## 11. CHARACTERS (LIMITED)

Policy: no persistent mascot. At most TWO characters exist, both built as Rive state machines in the sticker style (chunky shapes, ink outline, flat color, expressive faces).
- Character A: the AI Tutor persona (placeholder name to be chosen). Appears as the chat avatar and in the AI Tutor header and empty state. States: idle, listening, thinking, talking, celebrating, confused.
- Character B: the helper (placeholder name to be chosen). Appears ONLY in empty states, error pages (404, offline, maintenance), onboarding and Medium or Large celebrations. States: wave, cheer, shrug, sleep, tools.
Never in: forms, tables, quizzes, assignment solving, grading, builders, settings, data screens.
Assets needed: two Rive files with the state machines, plus static fallbacks (PNG or SVG) for the Minimal tier. Characters wear the current theme's colors through Rive color inputs.

---

## 12. EMOJI POLICY

The least amount possible. Use stickers and Lucide icons instead.
- Never in: navigation, buttons, labels, form text, data, tables, errors, headings.
- Allowed, sparingly: reaction stickers in celebrations (one emoji at most per celebration), the AI Tutor's replies when it chooses (not forced), and student-written content.
- When an emoji is shown as design, it is rendered as an illustrated sticker, not a font emoji, so it matches the style.

---

## 13. ICONOGRAPHY

- UI controls use Lucide at stroke width 2.25 to 2.5 (heavier than the Lucide default to match the outlines), sizes 16, 20, 24, 32. Icons sit directly on the surface or in a small sticker tile (circle or squircle with outline) when they need emphasis, but not on every card.
- Illustrated sticker icons: skills (six), areas (six), rewards (coin, flame, trophy, chest, medals, certificate, level badge), statuses, empty states, big moments. Each exists in all 12 world color sets and is theme-recolorable (SVG with CSS variables).
- Icon animation: nav and action icons wiggle, spin or bounce on hover (CSS or Motion). Animated sticker icons (flame, coin, trophy) are Rive.

---

## 14. PAGE RECIPES (HOW THE SYSTEM SHOWS UP)

- Landing (SH-01): a tour through worlds: hero in Learn (display-xl sticker text, hero art as a sticker collage, a 3D accent object, a marquee), overview in Reading, learning areas as a horizontal pinned scroll with each skill's world, AI on a night stage with the AI world glow and the AI Tutor character, games on a Play band with torn-paper night edge, curriculum in Learn with the sequence assembling on scroll, teachers in Teacher tools, a final call-to-action band in Rewards with confetti. Page transitions to /login with the blob swipe.
- Student dashboard: Learn world. The Badge Plate is a large sticker plate (burst level medallion, XP bar with slosh, streak flame, coin). Quests are ticket cards with a tear-off claim action. Deadlines are notch cards with countdown. Announcements are speech-bubble cards.
- Lesson page: Learn tint, the reading area is a white sticker sheet with a thick outline and calm type inside, side tools as tabs, a scroll progress sticker.
- Quiz and assignment attempt: the focused layout keeps the full style: chunky timer pill, options as pressable sticker buttons, question navigator as numbered stickers, correct answers burst, wrong ones shake. Results use a Medium celebration.
- Practice tools: skill world pages with the skill's sticker art in the header and a skill-colored page tint.
- Games: selection page in Play with tilt cards; play screen on a night stage with the Play world glow; combos, score slosh, confetti on a personal best.
- AI Tutor: night chat surface with AI world accents, speech-bubble messages, the AI Tutor character in the header.
- Shop and rewards: Rewards world; the theme preview opens a night stage with the theme live on a miniature dashboard; purchases and reveals use Medium or Large celebrations.
- Teacher and Admin apps: Teacher tools (Fern) and Admin tools (Cocoa) worlds, dense-data rules from 10.1, sticker nav rail, builders on a halftone canvas where dragged items behave like stickers, AI action cards as sticker cards with a spark pop on approve.
- Auth and error pages: world-colored sticker cards; 404 and maintenance use Character B.

---

## 15. APP SHELL STYLING

- Sidebar (desktop): a floating vertical rail of stickers, outlined, in the area world `main`. Nav items are pills with an icon sticker; the active item is raised (shadow-md) with a slight rotation and a highlighter pill that slides between items. Collapsed state shows icon stickers only. Counts are burst badges.
- Top bar: a chunky strip with the page title in Fredoka, the global search as a pill, and sticker stats on the right (streak flame, coins, XP chip) for students; the mute button and notification bell are always visible.
- Mobile tab bar: a floating pill bar at the bottom with an ink outline and hard shadow; the active tab pops and bounces; a center action when relevant.
- Page header band: a full-width band in world `main` or `soft` with the page title in display type, parallax sticker art, and a shaped bottom edge.
- Focused layouts (quiz, assignment solving, games, grading, builders): the shell collapses but the style stays: slim sticker header with exit, timer and progress, the mute button, and the same background world.

---

## 16. STACK, LIBRARIES AND REPO IMPACT

Confirmed existing: Vite, React 18, React Router v6, TypeScript, Tailwind CSS 3.4, GSAP, Lenis, Lucide React.
Add (all lazy where noted): Motion (framer-motion), Rive (@rive-app/react-canvas, lazy), lottie (only if needed, lazy), Howler.js (lazy after first paint), canvas-confetti (lazy), three and @react-three/fiber and @react-three/drei helpers (lazy chunk), Radix UI primitives (a11y), Recharts, React Hook Form and Zod, TanStack Query, Zustand (effects tier, sound and settings stores), date-fns.
Notes on the existing docs and project:
- frontend/docs/01-tech-stack/tech-stack.md says "no animation library beyond Tailwind transitions and Framer Motion opt-in". This is superseded: the animation stack in this spec is the standard.
- Supabase and i18next appear in the old docs. Our specs say frontend only with mock data and English UI. Keep the packages out of the build until a decision is made (section 17).
- package-lock.json exists while the old docs say pnpm. Pick one package manager.
- tailwind.config.ts and globals.css must be rewritten from this file (tokens, worlds, shapes, shadows, fluid type, breakpoints). The existing landing styles.css is ignored.
New shared pieces required (each becomes tasks in the plan):
WorldProvider and data-world mechanism, ThemeProvider (full re-skin), ShapeFrame, Sticker, Squiggle (self-drawing SVG), Halftone and Grain layers, Marquee, Button and the full kit styled per section 10, EffectsProvider (tier, governor), Lenis provider, TransitionOutlet with per-area wipes and Flip morphs, CursorLayer, MagneticWrap, TiltCard, SoundProvider with Howler sprite loader and mute control, ConfettiProvider and burst helper, Celebration queue, Rive host component, R3F Stage (lazy) with fallbacks, SplitText reveal helper, scroll progress sticker, page header band component, dev pages: /dev/styleguide (tokens, shapes, components) and /dev/motion (every animation, FPS meter, tier switcher).

---

## 17. OPEN QUESTIONS AND ASSUMPTIONS

Assumptions I made (confirm or correct):
1. The two characters are the AI Tutor persona and one helper for empty, error and celebration states; no other character appears.
2. Gradients are limited to the exceptions in 3.6.
3. Free starter themes are Candy Pop (default) and Sorbet, both light. Dark "Night themes" can exist only as purchasable items. Teachers and Admins pick among the free starters unless you want them to buy themes too.
4. Sound, cursor and page transition styles are global, not part of themes (v1).
5. The sticker pack and character art are original illustrations still to be produced; until then, placeholders built from shapes are used.
6. Admin tools (Cocoa) is a deliberately warmer, browner world so the admin side feels distinct but still colorful.
7. Fonts: Fredoka, Figtree, Caveat, IBM Plex Sans Arabic, Baloo Bhaijaan 2 (all open source).
8. UI tap sounds stay on for teachers and admins (with a quick "Taps off"); you may prefer them off by default for grading sessions.

Still open:
- Do teachers and admins get purchasable themes, or only the free starters?
- The names of the two characters and whether you already have art direction for them.
- Will the school logo sit on a sticker plate on colored backgrounds, or only on plain surfaces (SHARED-SPEC says plain light surface; this system's colored world backgrounds need a plain plate)?
- Supabase and i18next: keep them in the project plan or remove them until needed?
- Package manager: npm (a lockfile exists) or pnpm (the old docs).
