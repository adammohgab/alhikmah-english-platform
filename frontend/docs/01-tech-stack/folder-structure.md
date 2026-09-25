# Frontend Folder Structure

```
src/
├── app/
│   ├── App.tsx                  # Root: providers (Query, i18n, Auth) + router
│   ├── router.tsx                # Route tree, role-based route guards
│   └── providers/
│       ├── AuthProvider.tsx
│       ├── QueryProvider.tsx
│       └── I18nProvider.tsx
│
├── components/
│   ├── ui/                       # Primitives — see 04-components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Toast.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Avatar.tsx
│   │   ├── EmptyState.tsx
│   │   └── Skeleton.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── MobileTabBar.tsx
│   └── domain/                   # Product-specific composed components
│       ├── course/                (CourseCard, UnitAccordion, LessonList...)
│       ├── test/                  (QuestionEditor, QuestionRenderer, Timer...)
│       ├── reports/                (ScoreTrendChart, SkillRadar, ClassTable...)
│       ├── ai-tutor/               (TutorChatPanel, TutorMessageBubble...)
│       └── games/                  (GameCard, VocabularyMatchBoard...)
│
├── features/                     # Route-level feature modules, one per page
│   ├── auth/
│   ├── student/
│   │   ├── dashboard/
│   │   ├── my-courses/
│   │   ├── lesson/
│   │   ├── take-test/
│   │   ├── my-results/
│   │   └── assignments/
│   ├── teacher/
│   │   ├── class-overview/
│   │   ├── course-editor/
│   │   ├── test-builder/
│   │   ├── question-bank/
│   │   ├── grade-submissions/
│   │   └── announcements/
│   └── supervisor/
│       ├── school-overview/
│       ├── class-reports/
│       ├── course-review/
│       ├── test-results/
│       └── manage-users/
│   # Each feature folder: index.tsx (page), components/ (page-only pieces),
│   # hooks/ (data hooks for this page), types.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── types.ts               # Generated DB types
│   ├── api/                       # React Query hooks grouped by domain
│   │   ├── courses.ts
│   │   ├── tests.ts
│   │   ├── assignments.ts
│   │   ├── reports.ts
│   │   ├── users.ts
│   │   └── ai.ts
│   ├── auth/
│   │   ├── useAuth.ts
│   │   └── roles.ts
│   └── utils/
│       ├── formatDate.ts
│       ├── formatScore.ts
│       └── cn.ts                  # className merge helper
│
├── stores/                       # Zustand — client-only UI state
│   ├── testSessionStore.ts
│   ├── sidebarStore.ts
│   └── aiTutorStore.ts
│
├── content/                      # Static content model types + skill tag config
│   ├── contentTypes.ts            # Grade/Term/Unit/Lesson/Activity/Assessment types
│   └── skills.ts                  # Reading/Writing/Listening/Speaking/Grammar/Vocabulary config
│
├── styles/
│   ├── globals.css
│   └── tailwind.config.ts (or root-level, per Vite convention)
│
├── locales/
│   ├── en/
│   └── ar/
│
└── types/
    └── shared.ts                 # Cross-cutting types (Role, User, ApiError...)
```

## Rules

- A `features/*` page file is thin: it composes `domain/` and `ui/` components and
  wires up `lib/api/*` hooks. It does not contain raw fetch calls, raw Tailwind
  soup unrelated to layout, or business logic that belongs in `lib/`.
- Anything used by more than one role (e.g. a test-taking UI reused if a teacher
  previews a quiz) lives in `components/domain/`, not duplicated per role folder.
- One component per file. File name matches export name.
- No default exports for components (named exports only) — improves refactor safety
  and AI-agent grep-ability.
