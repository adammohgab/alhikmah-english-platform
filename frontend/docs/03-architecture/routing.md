# Routing

React Router v6, route tree defined in `app/router.tsx`. Role-based access enforced
at the route level via a `<RoleGuard roles={[...]}>` wrapper — never hidden purely by
UI (nav item removed but route still reachable is a bug).

## Route map

```
/login                              public
/logout                             public (action route)

/app                                 requires auth, redirects to role home if bare
├── student/                        role: student
│   ├── dashboard                    (default/home for student)
│   ├── courses                      "My courses"
│   ├── courses/:courseId/lessons/:lessonId   "Lesson page"
│   ├── tests/:testId                "Take a test"
│   ├── results                      "My results"
│   └── assignments                  "Assignments"
│
├── teacher/                        role: teacher
│   ├── overview                     (default/home for teacher) "Class overview"
│   ├── courses                      "Course editor" (list)
│   ├── courses/:courseId/edit       "Course editor" (detail)
│   ├── tests                        "Test builder" (list)
│   ├── tests/:testId/edit           "Test builder" (detail)
│   ├── question-bank                "Question bank"
│   ├── submissions                  "Grade submissions"
│   └── announcements                "Announcements"
│
└── supervisor/                     role: supervisor
    ├── overview                     (default/home for supervisor) "School overview"
    ├── reports/classes              "Class reports"
    ├── courses/review               "Course review"
    ├── tests/results                "Test results"
    ├── users                        "Manage users"
    └── announcements                "Announcements"
```

## Rules

- `/app` with no sub-path redirects based on the authenticated user's role to their
  default page (student → dashboard, teacher → overview, supervisor → overview).
- A user attempting to load a route outside their role is redirected to their own
  default page, not shown a raw 403 page — with a toast: "You don't have access to
  that page."
- Deep-linkable state (selected filter, active tab) goes in the URL as search
  params (`?class=8B&skill=grammar`), not only in component state — reports and
  lists must be shareable/bookmarkable within a role.
- Route-level code splitting: each `features/*` page is lazy-loaded
  (`React.lazy` + `Suspense`, skeleton fallback matching that page's layout, not a
  generic spinner).
- Breadcrumb/page title in the TopBar is derived from a `handle` on each route
  (React Router's route object `handle` field), not hardcoded per component — one
  source of truth for the page's display name.

## Auth flow

1. `/login` — single login screen for all three roles (see
   `05-pages/shared/auth.md`). Role is derived from the authenticated user's
   record, not chosen at login.
2. On success, Supabase session stored via its client; `AuthProvider` exposes
   `{ user, role, status }` to the whole app via context, backed by a React Query
   `useAuth` hook that also handles session refresh.
3. Route guards read role from this context — never from a locally cached value
   that could go stale after a role change.
