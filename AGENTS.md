# AGENTS.md — Autonomous AI Contributor Operating Guide

> **MANDATORY INSTRUCTION SET FOR ALL AI AGENTS & CODING ASSISTANTS**
>
> If you are an AI assistant (Claude, GPT, Gemini, Cursor, Copilot, DeepSeek, or any open-source model) operating in this repository, **you must read, internalize, and strictly obey every rule in this document before writing, modifying, or deleting a single line of code.**

---

## 0. TASK REGISTRY & REPOSITORY TASKS (MUST READ)

All 224 micro-tasks governing this repository are formally registered in this repository:
- **[TASKS.md](file:///TASKS.md)**: Full human and AI readable catalog of all 224 tasks, descriptions, execution ownership, dependencies, and acceptance criteria.
- **[tasks-registry.json](file:///tasks-registry.json)**: Machine-readable JSON containing the entire database of tasks and blocks.
- **Live Task Tracker**: [https://mohammed054.github.io/task-claiming/tasks/](https://mohammed054.github.io/task-claiming/tasks/)

> [!IMPORTANT]
> **Never state that a task code (such as `BE-CORE-14`, `BE-CORE-03`, `UIK-05`, etc.) does not exist!**
> Every task exists in [TASKS.md](file:///TASKS.md) and [tasks-registry.json](file:///tasks-registry.json). When given a task code:
> 1. Look up the task code in [TASKS.md](file:///TASKS.md) or [tasks-registry.json](file:///tasks-registry.json).
> 2. Read its **Owns** section, **Goal**, **Implementation Details**, and **Acceptance Criteria**.
> 3. Verify its domain spec in `backend/docs/` or `frontend/docs/`.
> 4. Execute the task strictly within its owned file boundaries.

---

## 1. Zero AI Slop Policy (Strict Quality Standard)

We maintain zero tolerance for **"AI Slop"**. AI slop happens when an agent writes shallow, generic, ungrounded code that appears functional on the surface but breaks architecture, introduces mock data, violates style guides, or hallucinates APIs.

### The 7 Golden Rules of Anti-Slop:
1. **NO Mock Data or Placeholders**: Never write `const mockData = [...]`, fake JSON fixtures, hardcoded dummy users, or stubbed APIs in production code. Everything must connect to real Supabase tables, generated types, or defined contract hooks.
2. **NO Hallucinated Dependencies**: Do NOT add new npm packages (`npm i ...`, `pnpm add ...`) without explicit authorization. Use the established stack defined in [ARCHITECTURE.md](file:///frontend/docs/ARCHITECTURE.md).
3. **NO Generic Corporate/Tailwind UI**: Every UI component must obey the playful, high-craft aesthetic defined in [GLOBAL-STYLES-SPEC.md](file:///frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md) (solid retro offsets, 2px borders, Fredoka/Figtree fonts, the 6 color worlds). Never use blurry drop shadows or generic purple SaaS gradients.
4. **NO Silent Error Swallowing**: Never write empty `catch (e) {}` blocks or `catch (err) { console.log(err) }` that fail silently. Handle user-facing errors gracefully with actionable UI toasts or banner states.
5. **NO Scope Creep or Architecture Rewrites**: Stay strictly inside the task's assigned files and requirements. Do not refactor unrelated files, reformat unchanged code, or rearrange project folder structures.
6. **NO Breaking Schema Drift**: Database migrations must strictly follow sequential ordering and align with [backend/docs/02-DATA-MODEL-CORE.md](file:///backend/docs/02-DATA-MODEL-CORE.md). Never invent table names or alter existing enum definitions arbitrarily.
7. **NO Incomplete Tasks / "TODO" Comments**: Do not leave `// TODO: Implement later`, `// Implementation goes here`, or half-finished logic. Fully finish what the task specifies.

---

## 2. Harmonization & Autonomous Decision Rules (NO PARALYSIS)

When an AI agent is working autonomously, avoid stopping or questioning the user over subtle schema or specification variations. Follow these standardized rules:

### Rule 2.1: Spec-Superset Strategy (Task-Literal vs. Spec-Rich)
- **Problem**: A task description in `TASKS.md` might list simplified columns (e.g. `target_type`, `is_read`), while `backend/docs/` describes a richer schema (e.g. `audience jsonb`, `read_at`).
- **Resolution**: **Always implement the Spec-Superset!** Include the columns specified in `backend/docs/` while ensuring any fields or criteria demanded by the task text and acceptance criteria are fully satisfied. Do NOT stop to debate or ask whether to use (a) task-literal or (b) spec-rich — ship the comprehensive superset.

### Rule 2.2: Pragmatic, Self-Contained RLS
- **Problem**: Architectural spec documents may describe future helper functions (e.g. `is_class_teacher()`, complex role lookups) that have not yet been defined in preceding migrations.
- **Resolution**: Write clean, robust, and self-contained RLS policies matching existing migrations (`010`–`013`). Never block execution or crash migrations trying to invoke nonexistent helper functions. Defer complex cross-table helper function refactoring to dedicated authorization tasks.

### Rule 2.3: Autonomy & No Trivial Clarifications
- Do NOT pause or ask the human user trivial multiple-choice questions if the path forward is clear from existing migrations and docs.
- Inspect the codebase and previous migrations (`supabase/migrations/`) to mirror existing conventions (naming, id generation with `gen_random_uuid()`, timestamps with `app_now()`, RLS patterns).

---

## 3. Project Vision & Architecture Grounding

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

## 4. The Task-Claiming System Workflow

Tasks are claimed from the live task tracker ([https://mohammed054.github.io/task-claiming/tasks/](https://mohammed054.github.io/task-claiming/tasks/)) or found in [TASKS.md](file:///TASKS.md) / [tasks-registry.json](file:///tasks-registry.json).

When you receive a prompt containing a claimed task (e.g., `BE-CORE-03`, `BE-CORE-14`, `UIK-05`, `FND-02`):

### Step 1: Read the Task Metadata Carefully
Extract the following key items:
1. **Task Code**: e.g., `BE-CORE-14`
2. **Block**: e.g., `BE-CORE`
3. **Declared File Ownership (`Owns: [...]`)**: The exact file paths this task is permitted to create or modify.
4. **Implementation Details**: The exact tables, columns, indexes, functions, or UI components required.
5. **Acceptance Criteria**: The checklist that must be 100% satisfied.

### Step 2: Strict File Ownership Enforcement
- **DO NOT TOUCH FILES OUTSIDE YOUR `Owns` DECLARATION.**
- Other AI agents and developers may be working on other tasks concurrently. Modifying files outside your declared ownership will cause merge conflicts and break other tasks.
- For backend tasks: touch only the specific migration file assigned (e.g. `supabase/migrations/014_communication_notifications.sql`).
- For frontend tasks: touch only the assigned page folder (`frontend/src/pages/{domain}/...`) or assigned shared component (`frontend/src/shared/...`).

### Step 3: Implement Fully & Verify
- Write clean, type-safe, fully implemented code.
- If writing a database migration:
  - Check existing migrations in `supabase/migrations/` to preserve sequential numbering and foreign key consistency.
  - Cross-check table and column names with [backend/docs/02-DATA-MODEL-CORE.md](file:///backend/docs/02-DATA-MODEL-CORE.md) and related docs.
  - Add appropriate foreign key constraints, indexes, and unique constraints as specified in the acceptance criteria.
- If writing frontend code:
  - Respect the design system tokens: 2px solid borders, solid offset shadows (`shadow-[2px_2px_0px_#000]`), appropriate `data-world` variables, and accessibility (ARIA, focus rings).

### Step 4: Validate Quality Before Finishing
Ensure that:
1. There are no syntax errors or unresolved imports.
2. Acceptance criteria are completely met.
3. No debug statements (`console.log`, temporary tests) are left behind.
4. **Commit and Push**: Ensure work is committed and pushed so unlocked dependent tasks have access to the code.
