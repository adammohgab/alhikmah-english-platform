import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  },
}));

function Probe() {
  const { isLoading, isAuthenticated, user } = useAuth();
  if (isLoading) return <p>loading</p>;
  return <p>{isAuthenticated && user ? `${user.role}:${user.adminLevel ?? "none"}` : "signed out"}</p>;
}

describe("AuthProvider (FND-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("reports signed out when there is no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("signed out")).toBeInTheDocument();
  });

  it("resolves the profile of a stored session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "u1",
        username: "root",
        display_name: "Root",
        role: "super_admin",
        status: "active",
        must_change_password: false,
      },
      error: null,
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("admin:super_admin")).toBeInTheDocument();
    });
  });

  it("signs out when the profile cannot be read", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "denied" } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("signed out")).toBeInTheDocument();
  });
});
