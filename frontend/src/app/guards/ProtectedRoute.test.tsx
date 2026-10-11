import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/app/providers/AuthProvider";
import type { AuthProfile } from "@/app/providers/auth-context";
import { ProtectedRoute, PublicOnlyRoute } from "./ProtectedRoute";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithAuth(
  initialEntries: string[],
  user: AuthProfile | null,
  allowedRoles?: AuthProfile["role"][],
) {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        value={{
          isAuthenticated: Boolean(user),
          isLoading: false,
          user,
          signOut: () => Promise.resolve(),
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/set-new-password" element={<div>Set New Password</div>} />
            <Route path="/account-not-active" element={<div>Account Not Active</div>} />
            <Route path="/no-access" element={<div>No Access</div>} />
            <Route path="/student" element={<div>Student Home</div>} />
            <Route path="/teacher" element={<div>Teacher Home</div>} />
            <Route path="/protected" element={<ProtectedRoute allowedRoles={allowedRoles} />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
            <Route
              path="/public-only"
              element={
                <PublicOnlyRoute>
                  <div>Public Only Content</div>
                </PublicOnlyRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ProtectedRoute guard", () => {
  it("redirects unauthenticated users to login with redirect param", () => {
    renderWithAuth(["/protected"], null);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("redirects users with mustChangePassword flag to /set-new-password", () => {
    const user: AuthProfile = {
      id: "u1",
      username: "student1",
      fullName: "Student One",
      role: "student",
      adminLevel: null,
      status: "active",
      mustChangePassword: true,
    };

    renderWithAuth(["/protected"], user);
    expect(screen.getByText("Set New Password")).toBeInTheDocument();
  });

  it("redirects users with archived or disabled status to /account-not-active", () => {
    const user: AuthProfile = {
      id: "u2",
      username: "student2",
      fullName: "Student Two",
      role: "student",
      adminLevel: null,
      status: "archived",
      mustChangePassword: false,
    };

    renderWithAuth(["/protected"], user);
    expect(screen.getByText("Account Not Active")).toBeInTheDocument();
  });

  it("redirects users without allowed role to /no-access", () => {
    const user: AuthProfile = {
      id: "u3",
      username: "student3",
      fullName: "Student Three",
      role: "student",
      adminLevel: null,
      status: "active",
      mustChangePassword: false,
    };

    renderWithAuth(["/protected"], user, ["teacher"]);
    expect(screen.getByText("No Access")).toBeInTheDocument();
  });

  it("allows access when role matches", () => {
    const user: AuthProfile = {
      id: "u4",
      username: "teacher1",
      fullName: "Teacher One",
      role: "teacher",
      adminLevel: null,
      status: "active",
      mustChangePassword: false,
    };

    renderWithAuth(["/protected"], user, ["teacher"]);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("PublicOnlyRoute redirects logged in user to role home", () => {
    const user: AuthProfile = {
      id: "u5",
      username: "student5",
      fullName: "Student Five",
      role: "student",
      adminLevel: null,
      status: "active",
      mustChangePassword: false,
    };

    renderWithAuth(["/public-only"], user);
    expect(screen.getByText("Student Home")).toBeInTheDocument();
  });
});
