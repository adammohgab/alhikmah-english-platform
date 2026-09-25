# Feature: Content & Data Structure

Source: `Al_Hikmah_English_Platform_Master_Reference.pdf`, "Content & Data Structure."
One consistent hierarchy so the same content powers lessons, quizzes, reports, games,
and the AI tutor without re-modeling data per feature.

## Hierarchy

```
Grade (9–12)
 └─ Term (Term 1, Term 2)
     └─ Unit (title, objectives)
         └─ Lesson (text, audio, video, resources)
             └─ Activity (practice, tagged with one or more skills)
             └─ Assessment (quiz: questions + result)
```

## Types (`content/contentTypes.ts`)

```ts
type Grade = 9 | 10 | 11 | 12;
type Term = 'term_1' | 'term_2';
type SkillTag = 'reading' | 'writing' | 'listening' | 'speaking' | 'grammar' | 'vocabulary';

interface Unit {
  id: string;
  grade: Grade;
  term: Term;
  title: string;
  objectives: string[];
  order: number;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  textContent?: string;       // rich text / markdown
  audioUrl?: string;
  videoUrl?: string;
  resources: LessonResource[]; // downloadable PDFs, worksheets
  order: number;
}

interface Activity {
  id: string;
  lessonId: string;
  type: 'practice';
  skillTags: SkillTag[];
  content: unknown; // shape depends on activity type
}

interface Assessment {
  id: string;
  lessonId?: string;   // lesson quiz
  unitId?: string;     // unit test
  title: string;
  questions: Question[]; // see quiz-and-test-components.md for Question shape
  durationMinutes?: number;
  allowRetakes: boolean;
  isPublished: boolean;
}
```

## Rules

1. **Skill tagging is mandatory and consistent.** Every `Activity` and every
   `Question` inside an `Assessment` carries at least one `SkillTag` from the fixed
   set of six. This is what makes `SkillBreakdownChart` (see `data-display.md`) and
   the AI tutor's "grade-aware, skill-aware" context possible — nothing downstream
   works if tagging is inconsistent or optional.
2. **Naming is stable, not cosmetic.** Unit/lesson `id`s, once published and attached
   to student results, are never renamed or reused — only `title` (display text) can
   change. Reports and AI context resolve by `id`, never by title string matching.
3. **One content model, many consumers.** A `Lesson` is fetched once via
   `useLesson(lessonId)` (React Query, see `state-and-data.md`) and rendered by
   whichever surface needs it — the student lesson page, the teacher preview inside
   the course editor, and the AI tutor's context payload all read the same shape.
   Never duplicate a parallel "lite" copy of lesson content for a specific feature.
4. **Games and AI are additive, not a fork.** Educational games (see `games.md`) and
   the AI tutor (see `ai-tutor.md`) read from this same structure (a unit's
   vocabulary list, a lesson's skill tags) — they do not introduce their own content
   authoring path. A teacher never has to enter the same vocabulary twice.
5. **Grades 9–12 only in v1**, matching the reference plan; the `Grade` type is a
   literal union, not an open number, so an out-of-range grade is a compile error,
   not a runtime surprise.

## Where this lives in the frontend

`content/contentTypes.ts` (types), `content/skills.ts` (the fixed `SkillTag` → label
+ muted color mapping used by `SkillTag`, `SkillBreakdownChart`, and course-card skill
accents), `lib/api/courses.ts` / `lib/api/tests.ts` (React Query hooks that fetch this
shape from Supabase). See `folder-structure.md` for exact paths.
