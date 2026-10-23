import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue, AuthProfile } from "@/app/providers/auth-context";
import { REMEMBER_STORAGE_KEY } from "@/shared/api/remember";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import AccountNotActivePage from "./index";
import { REASON_COPY, endSession, isBlockedStatus, parseReason } from "./account-status";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  localSignOut: vi.fn(),
  contextSignOut: vi.fn(),
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { signOut: mocks.localSignOut },
  },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

const SCHOOL_STATE = {
  school: {
    name: "Al Hikmah School",
    contact_email: "helpdesk@alhikmah.example",
    contact_phone: "+218 21 000 0000",
    office_hours: "Sun to Thu, 8:00 to 14:00",
    location: "Main building, room 12",
  },
};

function profile(
  status: AuthProfile["status"],
  role: AuthProfile["role"] = "student",
): AuthProfile {
  return {
    id: "user-1",
    username: "sara.k",
    fullName: "Sara Khaled",
    role,
    adminLevel: null,
    status,
    mustChangePassword: false,
  };
}

function authValue(user: AuthProfile | null, overrides: Partial<AuthContextValue> = {}) {
  return {
    ...defaultAuthContext,
    isAuthenticated: user !== null,
    user,
    signOut: mocks.contextSignOut,
    ...overrides,
  } satisfies AuthContextValue;
}

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname}
      {location.search}
    </p>
  );
}

function renderPage(entry = "/account-not-active", auth: AuthContextValue = authValue(null)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SoundContext.Provider value={sound}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/account-not-active" element={<AccountNotActivePage />} />
              <Route path="/login" element={<Where />} />
              <Route path="/student" element={<p>Student home</p>} />
            </Routes>
          </MemoryRouter>
        </SoundContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.rpc.mockResolvedValue({ data: SCHOOL_STATE, error: null });
  mocks.localSignOut.mockResolvedValue({ error: null });
  mocks.contextSignOut.mockResolvedValue(undefined);
});

describe("reason parsing", () => {
  it("accepts the known reasons and treats anything else as unknown", () => {
    expect(parseReason("locked")).toBe("locked");
    expect(parseReason(" Archived ")).toBe("archived");
    expect(parseReason("disabled")).toBe("disabled");
    expect(parseReason("pending")).toBe("pending");
    expect(parseReason("<script>")).toBe("unknown");
    expect(parseReason("")).toBe("unknown");
    expect(parseReason(null)).toBe("unknown");
  });

  it("treats every status except active as blocked", () => {
    expect(isBlockedStatus("active")).toBe(false);
    expect(isBlockedStatus("locked")).toBe(true);
    expect(isBlockedStatus("archived")).toBe(true);
  });

  it("never puts private data in the copy", () => {
    for (const copy of Object.values(REASON_COPY)) {
      expect(`${copy.summary} ${copy.next}`).not.toMatch(/\d|@|attempt|admin|by /i);
    }
  });
});

describe("endSession", () => {
  it("signs out everywhere, signs out locally and clears the remember choice", async () => {
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, "1");
    const everywhere = vi.fn().mockResolvedValue(undefined);
    await endSession(everywhere);
    expect(everywhere).toHaveBeenCalled();
    expect(mocks.localSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.localStorage.getItem(REMEMBER_STORAGE_KEY)).toBeNull();
  });

  it("still clears the local session when the server cannot be reached", async () => {
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, "1");
    await endSession(() => Promise.reject(new Error("offline")));
    expect(mocks.localSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.localStorage.getItem(REMEMBER_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when every step fails", async () => {
    mocks.localSignOut.mockRejectedValue(new Error("storage blocked"));
    await expect(endSession(() => Promise.reject(new Error("offline")))).resolves.toBeUndefined();
  });
});

describe("AccountNotActivePage", () => {
  it("shows the general text and the school contact options without a reason", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "This account is not active" }),
    ).toBeVisible();
    expect(screen.getByText("Your account has been archived or turned off.")).toBeVisible();
    expect(screen.getByText("Ask your school if you think this is a mistake.")).toBeVisible();
    expect(await screen.findByText("helpdesk@alhikmah.example")).toBeVisible();
    expect(screen.getByText("Sun to Thu, 8:00 to 14:00")).toBeVisible();
    expect(screen.getByText("+218 21 000 0000")).toBeVisible();
    expect(screen.getByText("Main building, room 12")).toBeVisible();
  });

  it.each([
    ["locked", "Your account is locked."],
    ["archived", "Your account has been archived."],
    ["disabled", "Your account has been turned off."],
    ["pending", "Your account is not active yet."],
  ])("explains the %s reason from the address", (reason, text) => {
    renderPage(`/account-not-active?reason=${reason}`);
    expect(screen.getByText(text)).toBeVisible();
  });

  it("falls back to the general text for an unknown reason", () => {
    renderPage("/account-not-active?reason=whatever");
    expect(screen.getByText("Your account has been archived or turned off.")).toBeVisible();
  });

  it("offers Back to sign in when nobody is signed in", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect((await screen.findByTestId("where")).textContent).toBe("/login");
  });

  it("uses the signed-in status and ignores the address", () => {
    renderPage("/account-not-active?reason=archived", authValue(profile("locked")));
    expect(screen.getByText("Your account is locked.")).toBeVisible();
  });

  it("does not show the username or the name of the person", () => {
    renderPage("/account-not-active", authValue(profile("locked")));
    expect(screen.queryByText(/sara/i)).not.toBeInTheDocument();
  });

  it("signs out completely and opens sign-in", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, "1");
    renderPage("/account-not-active", authValue(profile("archived")));

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect((await screen.findByTestId("where")).textContent).toBe("/login?reason=signed-out");
    expect(mocks.contextSignOut).toHaveBeenCalled();
    expect(mocks.localSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.localStorage.getItem(REMEMBER_STORAGE_KEY)).toBeNull();
  });

  it("still leaves when the sign-out request fails", async () => {
    const user = userEvent.setup();
    mocks.contextSignOut.mockRejectedValue(new Error("offline"));
    renderPage("/account-not-active", authValue(profile("locked")));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect((await screen.findByTestId("where")).textContent).toBe("/login?reason=signed-out");
    expect(mocks.localSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sends a signed-in person with an active account to their dashboard", () => {
    renderPage("/account-not-active?reason=locked", authValue(profile("active")));
    expect(screen.getByText("Student home")).toBeVisible();
  });

  it("waits while the session loads", () => {
    renderPage("/account-not-active", authValue(null, { isLoading: true }));
    expect(screen.getByText(/Loading your account/)).toBeVisible();
  });

  it("leaves out contact details that are not set", async () => {
    mocks.rpc.mockResolvedValue({ data: { school: { name: "Al Hikmah School" } }, error: null });
    renderPage();
    expect(await screen.findByText(/Contact details have not been added yet/)).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText("Office hours")).not.toBeInTheDocument();
    });
  });

  it("says so when the contact details cannot be loaded", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    renderPage();
    expect(
      await screen.findByText(/We could not load the school contact details/, {}, { timeout: 3000 }),
    ).toBeVisible();
  });
});
