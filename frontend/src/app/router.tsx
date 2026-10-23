import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "@/app/guards/ProtectedRoute";
import { PlaceholderView } from "@/app/PlaceholderView";

interface PageModule {
  default: ComponentType;
}

/** Loads a page when its route is first visited, so each page ships as its own chunk. */
const page = (load: () => Promise<PageModule>) => ({
  lazy: async () => ({ Component: (await load()).default }),
});

export const router = createBrowserRouter(
  [
    // Public Marketing / Landing Page
    {
      path: "/",
      ...page(() => import("@/pages/public/LandingPage")),
    },

    // Public Auth Pages (Redirect logged-in users)
    {
      path: "/login",
      element: (
        <PublicOnlyRoute>
          <Outlet />
        </PublicOnlyRoute>
      ),
      children: [{ index: true, ...page(() => import("@/pages/public/LoginPage")) }],
    },
    {
      path: "/forgot-password",
      element: (
        <PublicOnlyRoute>
          <Outlet />
        </PublicOnlyRoute>
      ),
      children: [{ index: true, ...page(() => import("@/pages/public/ForgotPasswordPage")) }],
    },

    // Special System States
    {
      path: "/set-new-password",
      ...page(() => import("@/pages/public/SetNewPasswordPage")),
    },
    {
      path: "/account-not-active",
      ...page(() => import("@/pages/public/AccountNotActivePage")),
    },
    {
      path: "/maintenance",
      ...page(() => import("@/pages/public/SystemPages/MaintenancePage")),
    },
    {
      path: "/no-access",
      ...page(() => import("@/pages/public/SystemPages/NoAccessPage")),
    },
    {
      path: "/offline",
      ...page(() => import("@/pages/public/SystemPages/OfflinePage")),
    },

    // Public Information Pages
    {
      path: "/help",
      ...page(() => import("@/pages/public/HelpContactPage")),
    },
    {
      path: "/faq",
      ...page(() => import("@/pages/public/FaqPage")),
    },
    {
      path: "/terms",
      ...page(() => import("@/pages/public/LegalPage")),
    },
    {
      path: "/about",
      ...page(() => import("@/pages/public/AboutPage")),
    },

    // Student Portal (Protected)
    {
      path: "/student",
      element: <ProtectedRoute allowedRoles={["student"]} />,
      children: [
        {
          index: true,
          ...page(() => import("@/pages/student/DashboardPage")),
        },
        {
          path: "courses",
          ...page(() => import("@/pages/student/CoursesPage")),
        },
        {
          path: "courses/:courseId",
          ...page(() => import("@/pages/student/CourseDetailsPage")),
        },
        {
          path: "courses/:courseId/units/:unitId",
          ...page(() => import("@/pages/student/UnitPage")),
        },
        {
          path: "lessons/:lessonId",
          ...page(() => import("@/pages/student/LessonPlayerPage")),
        },
        {
          path: "quizzes",
          ...page(() => import("@/pages/student/QuizzesHubPage")),
        },
        {
          path: "quizzes/:quizId/start",
          ...page(() => import("@/pages/student/QuizStartPage")),
        },
        {
          path: "quizzes/:quizId/attempt/:attemptId",
          ...page(() => import("@/pages/student/QuizAttemptPage")),
        },
        {
          path: "quizzes/:quizId/results/:attemptId",
          ...page(() => import("@/pages/student/QuizResultPage")),
        },
        {
          path: "assignments",
          ...page(() => import("@/pages/student/AssignmentsListPage")),
        },
        {
          path: "assignments/:assignmentId",
          ...page(() => import("@/pages/student/AssignmentDetailsPage")),
        },
        {
          path: "assignments/:assignmentId/solve",
          ...page(() => import("@/pages/student/AssignmentSolvePage")),
        },
        {
          path: "assignments/:assignmentId/results",
          ...page(() => import("@/pages/student/AssignmentResultPage")),
        },
        {
          path: "ai-tutor",
          ...page(() => import("@/pages/student/AiTutorPage")),
        },
        {
          path: "practice/vocabulary",
          ...page(() => import("@/pages/student/VocabularyPracticePage")),
        },
        {
          path: "practice/grammar",
          ...page(() => import("@/pages/student/GrammarPracticePage")),
        },
        {
          path: "practice/reading",
          ...page(() => import("@/pages/student/ReadingPracticePage")),
        },
        {
          path: "practice/writing",
          ...page(() => import("@/pages/student/WritingPracticePage")),
        },
        {
          path: "practice/translation",
          ...page(() => import("@/pages/student/TranslationPracticePage")),
        },
        {
          path: "games",
          ...page(() => import("@/pages/student/GamesHubPage")),
        },
        {
          path: "games/:gameId/results",
          ...page(() => import("@/pages/student/GameResultsPage")),
        },
        {
          path: "quests",
          ...page(() => import("@/pages/student/QuestsPage")),
        },
        {
          path: "achievements",
          ...page(() => import("@/pages/student/AchievementsPage")),
        },
        {
          path: "leaderboard",
          ...page(() => import("@/pages/student/LeaderboardPage")),
        },
        {
          path: "shop",
          ...page(() => import("@/pages/student/ShopPage")),
        },
        {
          path: "certificates",
          ...page(() => import("@/pages/student/CertificatesPage")),
        },
        {
          path: "notifications",
          ...page(() => import("@/pages/student/NotificationsPage")),
        },
        {
          path: "activity",
          ...page(() => import("@/pages/student/ActivityPage")),
        },
        {
          path: "profile",
          ...page(() => import("@/pages/student/ProfilePage")),
        },
        {
          path: "settings",
          ...page(() => import("@/pages/student/SettingsPage")),
        },
        {
          path: "*",
          element: <PlaceholderView title="Student Section" />,
        },
      ],
    },

    // Teacher Portal (Protected)
    {
      path: "/teacher",
      element: <ProtectedRoute allowedRoles={["teacher"]} />,
      children: [
        {
          index: true,
          ...page(() => import("@/pages/teacher/DashboardPage")),
        },
        {
          path: "classes",
          ...page(() => import("@/pages/teacher/ClassesListPage")),
        },
        {
          path: "classes/:classId",
          ...page(() => import("@/pages/teacher/ClassDetailPage")),
        },
        {
          path: "classes/compare",
          ...page(() => import("@/pages/teacher/CompareClassesPage")),
        },
        {
          path: "courses/generate",
          ...page(() => import("@/pages/teacher/CourseWizardPage")),
        },
        {
          path: "courses/:courseId/versions",
          ...page(() => import("@/pages/teacher/CourseBuilderPage")),
        },
        {
          path: "courses/:courseId/publish",
          ...page(() => import("@/pages/teacher/CoursePublishPage")),
        },
        {
          path: "lessons/planner",
          ...page(() => import("@/pages/teacher/LessonPlannerPage")),
        },
        {
          path: "lessons/:lessonId/edit",
          ...page(() => import("@/pages/teacher/LessonEditorPage")),
        },
        {
          path: "questions",
          ...page(() => import("@/pages/teacher/QuestionBankPage")),
        },
        {
          path: "rubrics",
          ...page(() => import("@/pages/teacher/RubricsPage")),
        },
        {
          path: "quizzes",
          ...page(() => import("@/pages/teacher/QuizzesHubPage")),
        },
        {
          path: "quizzes/:quizId/monitor",
          ...page(() => import("@/pages/teacher/QuizMonitorPage")),
        },
        {
          path: "quizzes/:quizId/results",
          ...page(() => import("@/pages/teacher/QuizResultsPage")),
        },
        {
          path: "assignments",
          ...page(() => import("@/pages/teacher/AssignmentsHubPage")),
        },
        {
          path: "assignments/:assignmentId/results",
          ...page(() => import("@/pages/teacher/AssignmentResultsPage")),
        },
        {
          path: "grading",
          ...page(() => import("@/pages/teacher/GradingQueuePage")),
        },
        {
          path: "grading/:submissionId",
          ...page(() => import("@/pages/teacher/GradingScreenPage")),
        },
        {
          path: "students",
          ...page(() => import("@/pages/teacher/StudentsDirectoryPage")),
        },
        {
          path: "students/:studentId/progress",
          ...page(() => import("@/pages/teacher/StudentProgressPage")),
        },
        {
          path: "students/:studentId/report-card",
          ...page(() => import("@/pages/teacher/StudentReportCardPage")),
        },
        {
          path: "students/:studentId/support-plan",
          ...page(() => import("@/pages/teacher/SupportPlanPage")),
        },
        {
          path: "reports",
          ...page(() => import("@/pages/teacher/ReportsPage")),
        },
        {
          path: "announcements",
          ...page(() => import("@/pages/teacher/AnnouncementsPage")),
        },
        {
          path: "notifications",
          ...page(() => import("@/pages/teacher/NotificationsPage")),
        },
        {
          path: "settings",
          ...page(() => import("@/pages/teacher/SettingsPage")),
        },
        {
          path: "*",
          element: <PlaceholderView title="Teacher Section" />,
        },
      ],
    },

    // Admin Portal (Protected)
    {
      path: "/admin",
      element: <ProtectedRoute allowedRoles={["admin"]} />,
      children: [
        {
          index: true,
          ...page(() => import("@/pages/admin/DashboardPage")),
        },
        {
          path: "users/:userId",
          ...page(() => import("@/pages/admin/UserDetailPage")),
        },
        {
          path: "curriculum",
          ...page(() => import("@/pages/admin/CurriculumAdminPage")),
        },
        {
          path: "curriculum/generate",
          ...page(() => import("@/pages/admin/CurriculumGeneratorPage")),
        },
        {
          path: "csv-import",
          ...page(() => import("@/pages/admin/CsvImportWizardPage")),
        },
        {
          path: "audit-log",
          ...page(() => import("@/pages/admin/AuditLogPage")),
        },
        {
          path: "*",
          element: <PlaceholderView title="Admin Section" />,
        },
      ],
    },

    // Catch-All / 404
    {
      path: "/404",
      ...page(() => import("@/pages/public/NotFoundPage")),
    },
    {
      path: "*",
      element: <Navigate to="/404" replace />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
