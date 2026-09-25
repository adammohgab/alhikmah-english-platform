# Al Hikmah English Learning Platform — Frontend Docs

Full frontend documentation set for the Al Hikmah Private School English platform
(React + TypeScript, Supabase backend). Source plan:
`Al_Hikmah_English_Platform_Master_Reference.pdf`.

## How to read this

1. **00-overview/** — what this is, who it's for, and the explicit non-goals that
   keep it from looking like a generic AI-generated template.
2. **01-tech-stack/** — exact tech choices and the folder structure. Final for v1.
3. **02-design-system/** — colors, typography, spacing/elevation, icons/imagery,
   motion, and `student-experience-amendment.md` (how student screens differ in tone
   from teacher/supervisor screens — cool for students, not corporate, still zero
   AI-slop/emoji/gradients).
4. **03-architecture/** — routing, state/data split, auth & roles.
5. **04-components/** — every reusable component's spec (the catalog every page must
   build from — no one-off styles on a page).
6. **05-pages/** — one file per page, organized by role (`shared/`, `student/`,
   `teacher/`, `supervisor/`).
7. **06-features/** — cross-cutting features that aren't a single page: content data
   structure, the AI tutor, educational games.
8. **07-roadmap/implementation-phases.md** — the phased build plan. Start here when
   handing this to a coding AI/agent — it tells you what to build, in what order, and
   what "done" means for each phase.

## The one-sentence brief

Build something that looks like it belongs to a school that's been teaching since
1992 for the adults (teachers/supervisors), and like a genuinely well-made study app
for the students — never a generic AI dashboard template, never emoji, never
gradient-and-glassmorphism decoration.
