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
  return (
    <p>{isAuthenticated && user ? `${user.role}:${user.adminLevel ?? "none"}` : "signed out"}</p>
  );
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

  function PasswordProbe() {
    const { isLoading, user } = useAuth();
    if (isLoading) return <p>loading</p>;
    return <p>{user?.mustChangePassword ? "must change" : "free"}</p>;
  }

  function profileRow(mustChange: boolean) {
    return {
      data: {
        id: "u1",
        username: "sara.k",
        display_name: "Sara",
        role: "student",
        status: "active",
        must_change_password: mustChange,
      },
      error: null,
    };
  }

  it("reads the profile again on a token refresh while the password must change", async () => {
    let notify: (event: string, session: unknown) => void = () => undefined;
    mocks.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: unknown) => void) => {
        notify = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );
    const session = { user: { id: "u1" } };
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.maybeSingle.mockResolvedValueOnce(profileRow(true));
    render(
      <AuthProvider>
        <PasswordProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText("must change")).toBeInTheDocument();

    mocks.maybeSingle.mockResolvedValueOnce(profileRow(false));
    notify("TOKEN_REFRESHED", session);
    expect(await screen.findByText("free")).toBeInTheDocument();
  });

  it("ignores a token refresh once the profile is settled", async () => {
    let notify: (event: string, session: unknown) => void = () => undefined;
    mocks.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: unknown) => void) => {
        notify = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );
    const session = { user: { id: "u1" } };
    mocks.getSession.mockResolvedValue({ data: { session } });
    mocks.maybeSingle.mockResolvedValue(profileRow(false));
    render(
      <AuthProvider>
        <PasswordProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText("free")).toBeInTheDocument();
    const reads = mocks.maybeSingle.mock.calls.length;

    notify("TOKEN_REFRESHED", session);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.maybeSingle.mock.calls.length).toBe(reads);
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
