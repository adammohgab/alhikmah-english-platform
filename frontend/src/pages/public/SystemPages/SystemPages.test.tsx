import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue, AuthProfile } from "@/app/providers/auth-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import type { PlatformSettingsState } from "@/shared/hooks/usePlatformSettings";

const settingsMock = vi.hoisted(() => ({
  settings: {
    maintenance: { enabled: true, message: "Back soon", expected_back_at: null },
  } as unknown as PlatformSettingsState,
  refetch: vi.fn(),
}));

vi.mock("@/shared/hooks/usePlatformSettings", () => ({
  usePlatformSettings: () => ({
    settings: settingsMock.settings,
    refetch: settingsMock.refetch,
    isFeatureEnabled: () => false,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

import { MaintenancePage, NoAccessPage, OfflineBanner, OfflinePage } from "./index";
import { describeTimeUntil } from "./time";
import { safeReturnPath } from "./paths";

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function profile(overrides: Partial<AuthProfile>): AuthProfile {
  return {
    id: "u1",
    username: "user",
    fullName: "User",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
    ...overrides,
  };
}

function signedIn(overrides: Partial<AuthProfile>, extra: Partial<AuthContextValue> = {}) {
  return {
    ...defaultAuthContext,
    isAuthenticated: true,
    user: profile(overrides),
    ...extra,
  } satisfies AuthContextValue;
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}</p>;
}

function renderAt(
  entry: string | { pathname: string; state?: unknown },
  ui: ReactNode,
  auth = defaultAuthContext,
) {
  return render(
    <SoundContext.Provider value={sound}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="*" element={ui} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundContext.Provider>,
  );
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

describe("PUB-14: OfflinePage (SH-12)", () => {
  const assign = vi.fn();
  const realLocation = window.location;

  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...realLocation, assign },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    setOnline(true);
    Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  });

  it("shows the spec copy and waits while offline", () => {
    setOnline(false);
    renderAt("/offline", <OfflinePage />);
    expect(screen.getByRole("heading", { name: "You are offline." })).toBeInTheDocument();
    expect(screen.getByText(/saved on this device and will sync/)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("reloads by itself once the browser reports it is online again", () => {
    vi.useFakeTimers();
    setOnline(false);
    renderAt("/offline?next=/student/courses", <OfflinePage />);
    expect(assign).not.toHaveBeenCalled();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText(/back online/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/student\/courses$/));
  });

  it("never sends the person back to /offline or off the site", () => {
    vi.useFakeTimers();
    setOnline(true);
    renderAt("/offline?next=//evil.example", <OfflinePage />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/$/));
    expect(safeReturnPath("/offline")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
    expect(safeReturnPath("/\\evil")).toBeNull();
    expect(safeReturnPath("/teacher/classes?x=1")).toBe("/teacher/classes?x=1");
  });

  it("returns signed-in people to their dashboard when no target is given", () => {
    vi.useFakeTimers();
    setOnline(true);
    renderAt("/offline", <OfflinePage />, signedIn({ role: "teacher" }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/teacher$/));
  });

  it("Try again says so while still offline", async () => {
    setOnline(false);
    const user = userEvent.setup();
    renderAt("/offline", <OfflinePage />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(/Still offline/)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("OfflineBanner follows the connection state", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Offline. Changes will sync when you reconnect.",
    );
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PUB-14: MaintenancePage (SH-13)", () => {
  beforeEach(() => {
    settingsMock.refetch.mockReset();
    settingsMock.refetch.mockResolvedValue({ data: settingsMock.settings });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the admin's message from platform settings", () => {
    renderAt("/maintenance", <MaintenancePage />);
    expect(screen.getByRole("heading", { name: "We are doing maintenance." })).toBeInTheDocument();
    expect(screen.getByText("Back soon")).toBeInTheDocument();
    expect(screen.queryByText("Expected back")).not.toBeInTheDocument();
  });

  it("shows the expected return time and a relative estimate", () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString();
    settingsMock.settings = {
      maintenance: { enabled: true, message: "Upgrading", expected_back_at: soon },
    } as unknown as PlatformSettingsState;
    renderAt("/maintenance", <MaintenancePage />);
    expect(screen.getByText("Expected back")).toBeInTheDocument();
    expect(screen.getByText(/That is in 2 hours\./)).toBeInTheDocument();
  });

  it("says the time has passed once it has", () => {
    settingsMock.settings = {
      maintenance: {
        enabled: true,
        message: "Upgrading",
        expected_back_at: new Date(Date.now() - 60_000).toISOString(),
      },
    } as unknown as PlatformSettingsState;
    renderAt("/maintenance", <MaintenancePage />);
    expect(screen.getByText(/back any moment now/)).toBeInTheDocument();
  });

  it("ignores an unreadable return time", () => {
    settingsMock.settings = {
      maintenance: { enabled: true, message: "Upgrading", expected_back_at: "soon-ish" },
    } as unknown as PlatformSettingsState;
    renderAt("/maintenance", <MaintenancePage />);
    expect(screen.queryByText("Expected back")).not.toBeInTheDocument();
  });

  it("Check again stays put while maintenance is still on", async () => {
    const user = userEvent.setup();
    renderAt("/maintenance", <MaintenancePage />);
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText(/Still under maintenance/)).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/maintenance");
  });

  it("Check again moves on once maintenance has ended", async () => {
    const user = userEvent.setup();
    renderAt("/maintenance", <MaintenancePage />, signedIn({ role: "student" }));
    settingsMock.refetch.mockResolvedValue({
      data: { maintenance: { enabled: false } },
    });
    await user.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/student"));
  });

  it("reports a failed check", async () => {
    const user = userEvent.setup();
    renderAt("/maintenance", <MaintenancePage />);
    settingsMock.refetch.mockRejectedValue(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText(/could not check right now/)).toBeInTheDocument();
  });

  it("sends admins to the admin app instead", () => {
    renderAt(
      "/maintenance",
      <MaintenancePage />,
      signedIn({ role: "admin", adminLevel: "school_admin" }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/admin");
  });

  it("describeTimeUntil picks sensible units", () => {
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    expect(describeTimeUntil(new Date(now - 1), now)).toBeNull();
    expect(describeTimeUntil(new Date(now + 30 * 1000), now)).toBe("in 1 minute");
    expect(describeTimeUntil(new Date(now + 35 * 60_000), now)).toBe("in 35 minutes");
    expect(describeTimeUntil(new Date(now + 3 * 3_600_000), now)).toBe("in 3 hours");
    expect(describeTimeUntil(new Date(now + 5 * 86_400_000), now)).toBe("in 5 days");
  });
});

describe("PUB-14: NoAccessPage (SH-14)", () => {
  it("explains the 403 and names the area from router state", () => {
    renderAt(
      { pathname: "/no-access", state: { requiredRole: "teacher" } },
      <NoAccessPage />,
      signedIn({ role: "student" }),
    );
    expect(
      screen.getByRole("heading", { name: "This page is not available for your account." }),
    ).toBeInTheDocument();
    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    expect(screen.getByText("This page is for teachers.")).toBeInTheDocument();
    expect(screen.getByText("You are signed in as a student.")).toBeInTheDocument();
    expect(screen.getByText(/sign in with the username and password/i)).toBeInTheDocument();
  });

  it("uses the Super admin line for the admin-level case", () => {
    renderAt(
      { pathname: "/no-access", state: { requiredAdminLevel: "super_admin" } },
      <NoAccessPage />,
      signedIn({ role: "admin", adminLevel: "school_admin" }),
    );
    expect(screen.getByText("Only a Super admin can open this page.")).toBeInTheDocument();
    expect(screen.getByText("You are signed in as a School admin.")).toBeInTheDocument();
  });

  it("stays generic when the state is missing or unrecognized", () => {
    renderAt(
      { pathname: "/no-access", state: { requiredRole: "wizard" } },
      <NoAccessPage />,
      signedIn({ role: "student" }),
    );
    expect(screen.queryByText(/This page is for/)).not.toBeInTheDocument();
  });

  it("the dashboard button goes to the person's own area and has no way back to the forbidden page", async () => {
    const user = userEvent.setup();
    renderAt("/no-access", <NoAccessPage />, signedIn({ role: "student" }));
    expect(screen.queryByRole("button", { name: /go back/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to my dashboard" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/student");
  });

  it("never redirects by itself", () => {
    renderAt("/no-access", <NoAccessPage />, signedIn({ role: "teacher" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/no-access");
  });

  it("signs out and goes to sign-in to switch account", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderAt("/no-access", <NoAccessPage />, signedIn({ role: "student" }, { signOut }));
    await user.click(screen.getByRole("button", { name: "Sign out and switch account" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/login"));
  });

  it("tells the person when sign-out fails and stays on the page", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockRejectedValue(new Error("offline"));
    renderAt("/no-access", <NoAccessPage />, signedIn({ role: "student" }, { signOut }));
    await user.click(screen.getByRole("button", { name: "Sign out and switch account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not sign you out/);
    expect(screen.getByTestId("path")).toHaveTextContent("/no-access");
  });

  it("signed-out visitors are sent to plain sign-in, with no redirect target", async () => {
    const user = userEvent.setup();
    renderAt("/no-access", <NoAccessPage />);
    expect(screen.queryByText(/signed in as/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    expect(window.location.search).toBe("");
  });
});
