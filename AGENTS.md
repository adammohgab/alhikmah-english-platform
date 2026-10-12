# AGENTS.md — Autonomous AI Contributor Operating Guide

> **MANDATORY INSTRUCTION SET FOR ALL AI AGENTS & CODING ASSISTANTS**
>
> If you are an AI assistant (Claude, GPT, Gemini, Cursor, Copilot, DeepSeek, or any open-source model) operating in this repository, **you must read, internalize, and strictly obey every rule in this document before writing, modifying, or deleting a single line of code.**

---

## 1. Zero AI Slop Policy (Strict Quality Standard)

We maintain zero tolerance for **"AI Slop"**. AI slop happens when an agent writes shallow, generic, ungrounded code that appears functional on the surface but breaks architecture, introduces mock data, violates style guides, or hallucinate APIs.

### The 7 Golden Rules of Anti-Slop:
1. **NO Mock Data or Placeholders**: Never write `const mockData = [...]`, fake JSON fixtures, hardcoded dummy users, or stubbed APIs in production code. Everything must connect to real Supabase tables, generated types, or defined contract hooks.
2. **NO Hallucinated Dependencies**: Do NOT add new npm packages (`npm i ...`, `pnpm add ...`) without explicit authorization. Use the established stack defined in [ARCHITECTURE.md](file:///frontend/docs/ARCHITECTURE.md).
3. **NO Generic Corporate/Tailwind UI**: Every UI component must obey the playful, high-craft aesthetic defined in [GLOBAL-STYLES-SPEC.md](file:///frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md) (solid retro offsets, 2px borders, Fredoka/Figtree fonts, the 6 color worlds). Never use blurry drop shadows or generic purple SaaS gradients.
4. **NO Silent Error Swallowing**: Never write empty `catch (e) {}` blocks or `catch (err) { console.log(err) }` that fail silently. Handle user-facing errors gracefully with actionable UI toasts or banner states.
5. **NO Scope Creep or Architecture Rewrites**: Stay strictly inside the task's assigned files and requirements. Do not refactor unrelated files, reformat unchanged code, or rearrange project folder structures.
6. **NO Breaking Schema Drift**: Database migrations must strictly follow sequential ordering and align with [backend/docs/02-DATA-MODEL-CORE.md](file:///backend/docs/02-DATA-MODEL-CORE.md). Never invent table names or alter existing enum definitions arbitrarily.
7. **NO Incomplete Tasks / "TODO" Comments**: Do not leave `// TODO: Implement later`, `// Implementation goes here`, or half-finished logic. Fully finish what the task specifies.

---

## 2. Project Vision & Architecture Grounding

**Al Hikmah English Platform** is an English learning ecosystem for Libyan secondary students (Grades 7–12), built with institutional rigor and engaging gamification.

### Source of Truth Specs
Before taking action, you **MUST** consult the exact markdown specification governing your domain:
- **Design System & Styles**: [frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md](file:///frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md)
- **Frontend Architecture**: [frontend/docs/ARCHITECTURE.md](file:///frontend/docs/ARCHITECTURE.md)
- **Student Experience & Gamification**: [frontend/docs/03-student/STUDENT-SPEC.md](file:///frontend/docs/03-student/STUDENT-SPEC.md) & [ECONOMY-AND-GAMES.md](file:///frontend/docs/03-student/ECONOMY-AND-GAMES.md)
- **Teacher Tools & LMS**: [frontend/docs/04-teacher/TEACHER-SPEC.md](file:///frontend/docs/04-teacher/TEACHER-SPEC.md)
- **Admin Management**: [frontend/docs/05-admin/ADMIN-SPEC.md](file:///frontend/docs/05-admin/ADMIN-SPEC.md)
- **Backend Architecture & Database Schema**: [backend/docs/01-ARCHITECTURE.md](file:///backend/docs/01-ARCHITECTURE.md) through [14-TRACEABILITY-MATRIX.md](file:///backend/docs/14-TRACEABILITY-MATRIX.md)
- **Developer Workflow & Git Rules**: [CONTRIBUTING.md](file:///CONTRIBUTING.md)

---

## 3. The Task-Claiming System Workflow

Tasks are claimed from the live task tracker (`https://mohammed054.github.io/task-claiming/tasks/` or local tracker definitions in `scripts/definitions/`).

When you receive a prompt containing a claimed task (e.g., `BE-CORE-03`, `UIK-05`, `FND-02`):

### Step 1: Read the Task Metadata Carefully
Extract the following key items:
1. **Task Code**: e.g., `BE-CORE-03`
2. **Block**: e.g., `BE-CORE`
3. **Declared File Ownership (`Owns: [...]`)**: The exact file paths this task is permitted to create or modify.
4. **Implementation Details**: The exact tables, columns, indexes, functions, or UI components required.
5. **Acceptance Criteria**: The checklist that must be 100% satisfied.

### Step 2: Strict File Ownership Enforcement
- **DO NOT TOUCH FILES OUTSIDE YOUR `Owns` DECLARATION.**
- Other AI agents and developers may be working on other tasks concurrently. Modifying files outside your declared ownership will cause merge conflicts and break other tasks.
- For backend tasks: touch only the specific migration file assigned (e.g. `supabase/migrations/003_school_structure.sql`).
- For frontend tasks: touch only the assigned page folder (`frontend/src/pages/{domain}/...`) or assigned shared component (`frontend/src/shared/...`).

### Step 3: Implement Fully & Verify
- Write clean, type-safe, fully implemented code.
- If writing a database migration:
  - Check existing migrations in `supabase/migrations/` to preserve sequential numbering and foreign key consistency.
  - Cross-check table and column names with [backend/docs/02-DATA-MODEL-CORE.md](file:///backend/docs/02-DATA-MODEL-CORE.md).
  - Add appropriate foreign key constraints, indexes, and unique constraints as specified in the acceptance criteria.
- If writing frontend code:
  - Respect the design system tokens: 2px solid borders, solid offset shadows (`shadow-[2px_2px_0px_#000]`), appropriate `data-world` variables, and accessibility (ARIA, focus rings).

### Step 4: Validate Quality Before Finishing
Ensure that:
1. There are no syntax errors or unresolved imports.
2. Acceptance criteria are completely met.
3. No debug statements (`console.log`, temporary tests) are left behind.
