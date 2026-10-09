# PROJECT DOCS (FRONTEND)

These are the frontend documents for the school's English learning platform (working title: Wordland). They live at the repository root in `project-tasks/` and REPLACE `frontend/docs/`. The backend is documented separately in its own directory.

## Reading order
| # | File | What it is |
|---|---|---|
| 0 | 00-architecture/ARCHITECTURE.md | Repo layout, final tech stack, folder structure, data layer rules, auth and routing, testing, CI and deployment |
| 1 | 01-styles/GLOBAL-STYLES-SPEC.md | The single source of truth for look, motion, sound, effects, themes and performance (the "sticker book arcade" system) |
| 2 | 02-public/SHARED-SPEC.md | Landing page, sign-in and password screens, help, FAQ, legal, about, error pages, route guards, sessions, view-as mode |
| 3 | 03-student/STUDENT-SPEC.md | Every student page (ST-00 to ST-31) |
| 4 | 04-teacher/TEACHER-SPEC.md | Every teacher page (TC-00 to TC-32), the AI-first workflow |
| 5 | 05-admin/ADMIN-SPEC.md | Every admin page (AD-00 to AD-29), AI governance, gamification studios |
| 6 | 06-tasks/EXECUTION-PLAN.md | How the work is split into about 595 small parallel tasks; task format; backend gates |
| 7 | 07-contract/ | Frontend and backend contract. Created first when the backend docs phase starts |
| 8 | 08-product-rules/ECONOMY-AND-GAMES.md | Final XP, levels, coins, quests, badges, shop, leaderboard and all seven games |
| 8 | 08-product-rules/AI-BEHAVIOR.md | Final AI behavior: Tutor persona, modes, grading rubric, generation rules, safety, limits, exact messages |

## Precedence when two files disagree
1. 08-product-rules (numbers and behavior rules)
2. 01-styles (all visual, motion and sound rules)
3. The role spec for the page in question (layout, flow, content)
4. 00-architecture (how it is built)
If a conflict is found, fix the lower-precedence file.

## Migration (do once)
1. Delete `frontend/docs/`.
2. Copy these folders and this README into `project-tasks/` (replacing the old files there, which are not used).
3. Delete `frontend/package-lock.json` and install with pnpm.
4. Ignore the existing landing page code; it is removed when task PUB-B starts.
5. Create the backend directory with its own docs; the first backend document answers 07-contract.

## Status
- Frontend specs: complete (v1). All decisions are recorded in the "Decisions" sections of each file.
- Not yet generated: the task files in 06-tasks (after final review of the specs) and the 07-contract file (first deliverable of the backend docs phase).
- Needed from outside the docs: the original school logo file, final landing page copy, final Terms and Privacy text, and the art (sticker pack, Pip and Nova, sounds, 3D models), which has placeholders until produced.
- Decided later: data retention periods and the production hosting.
