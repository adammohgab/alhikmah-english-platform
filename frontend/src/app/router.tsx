import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "@/app/guards/ProtectedRoute";
import { PlaceholderView } from "@/app/PlaceholderView";

export const router = createBrowserRouter(
  [
    // Public Marketing / Landing Page
    {
      path: "/",
      element: <PlaceholderView title="Al Hikmah English Platform" />,
    },

    // Public Auth Pages (Redirect logged-in users)
    {
      path: "/login",
      element: (
        <PublicOnlyRoute>
          <PlaceholderView title="Sign In" />
        </PublicOnlyRoute>
      ),
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
      element: <PlaceholderView title="We are doing maintenance" />,
    },
    {
      path: "/no-access",
      element: <PlaceholderView title="This page is not available for your account" />,
    },

    // Public Information Pages
    {
      path: "/help",
      element: <PlaceholderView title="Help and Contact" />,
    },
    {
      path: "/faq",
      element: <PlaceholderView title="Frequently Asked Questions" />,
    },
    {
      path: "/terms",
      element: <PlaceholderView title="Terms and Privacy" />,
    },
    {
      path: "/about",
      element: <PlaceholderView title="About the Platform" />,
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
      element: <PlaceholderView title="We could not find that page" />,
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
