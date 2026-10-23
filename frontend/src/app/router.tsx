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
          <PlaceholderView title="Reset Password Request" />
        </PublicOnlyRoute>
      ),
    },

    // Special System States
    {
      path: "/set-new-password",
      element: <PlaceholderView title="Set a New Password" />,
    },
    {
      path: "/account-not-active",
      element: <PlaceholderView title="This Account is Not Active" />,
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
          element: <PlaceholderView title="Student Dashboard" />,
        },
        {
          path: "ai-tutor",
          ...page(() => import("@/pages/student/AiTutorPage")),
        },
        {
          path: "practice/translation",
          ...page(() => import("@/pages/student/TranslationPracticePage")),
        },
        {
          path: "practice/reading",
          ...page(() => import("@/pages/student/ReadingPracticePage")),
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
          path: "certificates",
          ...page(() => import("@/pages/student/CertificatesPage")),
        },
        {
          path: "quests",
          ...page(() => import("@/pages/student/QuestsPage")),
        },
        {
          path: "shop",
          ...page(() => import("@/pages/student/ShopPage")),
        },
        {
          path: "notifications",
          ...page(() => import("@/pages/student/NotificationsPage")),
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
          element: <PlaceholderView title="Teacher Dashboard" />,
        },
        {
          path: "lessons/:lessonId/edit",
          ...page(() => import("@/pages/teacher/LessonEditorPage")),
        },
        {
          path: "courses/generate",
          ...page(() => import("@/pages/teacher/CourseWizardPage")),
        },
        {
          path: "rubrics",
          ...page(() => import("@/pages/teacher/RubricsPage")),
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
          element: <PlaceholderView title="Admin Dashboard" />,
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
