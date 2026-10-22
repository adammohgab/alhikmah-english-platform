import { useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue, AuthProfile } from "@/app/providers/auth-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import SetNewPasswordPage from "./index";
import {
  PASSWORD_MESSAGES,
  allRulesMet,
  checkRules,
  measureStrength,
  saveNewPassword,
  validateAll,
} from "./set-password-logic";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  refreshSession: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  clearFlag: { current: (): void => undefined },
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    auth: { updateUser: mocks.updateUser, refreshSession: mocks.refreshSession },
    rpc: mocks.rpc,
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

const STUDENT: AuthProfile = {
  id: "user-1",
  username: "sara.k",
  fullName: "Sara Khaled",
  role: "student",
  adminLevel: null,
  status: "active",
  mustChangePassword: true,
};

function authValue(user: AuthProfile | null, overrides: Partial<AuthContextValue> = {}) {
  return {
    ...defaultAuthContext,
    isAuthenticated: user !== null,
    user,
    signOut: mocks.signOut,
    ...overrides,
  } satisfies AuthContextValue;
}

/** Holds the signed-in profile like AuthProvider does, so a session refresh can clear the flag. */
function Session({ initial, children }: { initial: AuthContextValue; children: ReactNode }) {
  const [auth, setAuth] = useState(initial);
  mocks.clearFlag.current = () => {
    setAuth((current) =>
      current.user === null
        ? current
        : { ...current, user: { ...current.user, mustChangePassword: false } },
    );
  };
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

function renderPage(auth: AuthContextValue = authValue(STUDENT)) {
  return render(
    <Session initial={auth}>
      <SoundContext.Provider value={sound}>
        <MemoryRouter initialEntries={["/set-new-password"]}>
          <Routes>
            <Route path="/set-new-password" element={<SetNewPasswordPage />} />
            <Route path="/login" element={<p>Login route</p>} />
            <Route path="/student" element={<p>Student home</p>} />
            <Route path="/admin" element={<p>Admin home</p>} />
          </Routes>
        </MemoryRouter>
      </SoundContext.Provider>
    </Session>,
  );
}

const replaceSpy = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, replace: replaceSpy },
  });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.refreshSession.mockImplementation(() => {
    // The real AuthProvider reads the profile again after a refresh and drops the flag.
    mocks.clearFlag.current();
    return Promise.resolve({ data: {}, error: null });
  });
  mocks.signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("password rules", () => {
  it("checks length, number, symbol and the username", () => {
    expect(allRulesMet(checkRules("abcdefg1!", "sara.k"))).toBe(true);
    expect(checkRules("abc1!", "sara.k").length).toBe(false);
    expect(checkRules("abcdefgh!", "sara.k").number).toBe(false);
    expect(checkRules("abcdefg1", "sara.k").symbol).toBe(false);
    expect(checkRules("sara.k", "sara.k").username).toBe(false);
    expect(checkRules("", "sara.k").username).toBe(false);
  });

  it("requires a match between the two fields", () => {
    expect(validateAll({ password: "abcdefg1!", confirm: "abcdefg1?" }, "sara.k").confirm).toBe(
      PASSWORD_MESSAGES.mismatch,
    );
    expect(validateAll({ password: "abcdefg1!", confirm: "abcdefg1!" }, "sara.k")).toEqual({});
  });
});

describe("strength", () => {
  it("is Weak until every rule passes, then Good, then Strong", () => {
    expect(measureStrength("", "u").level).toBe("none");
    expect(measureStrength("abcdefgh", "u").level).toBe("weak");
    expect(measureStrength("abcdefg1!", "u").level).toBe("good");
    expect(measureStrength("Abcdefghijk1!", "u").level).toBe("strong");
    expect(measureStrength("abcdefghijk1!", "u").level).toBe("good");
  });
});

describe("saveNewPassword", () => {
  it("changes the password, clears the flag and refreshes the session", async () => {
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "saved" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "abcdefg1!" });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_password_change");
    expect(mocks.refreshSession).toHaveBeenCalled();
  });

  it("does not report success when the flag cannot be cleared", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "password_not_changed", code: "P0001" },
    });
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "failed" });
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("still reports success when the session refresh fails", async () => {
    mocks.refreshSession.mockRejectedValue(new Error("offline"));
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "saved" });
  });

  it("does not touch the flag when the password change fails", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: { status: 400, code: "other" } });
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "failed" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats same_password on a retry as done and clears the flag", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: { status: 422, code: "same_password" } });
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "saved" });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_password_change");
  });

  it("maps an ended session and a network failure", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: { status: 401, code: "bad_jwt" } });
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({
      kind: "session-expired",
    });
    mocks.updateUser.mockRejectedValue(new Error("offline"));
    await expect(saveNewPassword("abcdefg1!")).resolves.toEqual({ kind: "network" });
  });
});

describe("SetNewPasswordPage", () => {
  it("shows the form, the rules checklist and a Sign out button", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible();
    expect(screen.getByLabelText(/^New password/)).toBeVisible();
    expect(screen.getByLabelText(/^Confirm new password/)).toBeVisible();
    expect(screen.getByText(/At least 8 characters/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("updates the meter and the checklist on every keystroke", async () => {
    const user = userEvent.setup();
    renderPage();
    const bar = screen.getByTestId("strength-bar");
    const label = screen.getByTestId("strength-label");
    const field = screen.getByLabelText(/^New password/);

    expect(bar).toHaveAttribute("data-level", "none");

    await user.type(field, "abc");
    expect(bar).toHaveAttribute("data-level", "weak");
    expect(label).toHaveTextContent("Weak");

    await user.type(field, "defg1!");
    expect(bar).toHaveAttribute("data-level", "good");
    expect(label).toHaveTextContent("Good");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveAttribute("data-met", "true");
    }

    await user.clear(field);
    await user.type(field, "Abcdefghijk1!");
    expect(bar).toHaveAttribute("data-level", "strong");
    expect(label).toHaveTextContent("Strong");
  });

  it("blocks submission when the rules are not met", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/^New password/), "abcdefgh");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefgh");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
    expect(await screen.findByText(PASSWORD_MESSAGES.rulesNotMet)).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("blocks submission when the passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/^New password/), "abcdefg1!");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefg1?");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
    expect(await screen.findByText(PASSWORD_MESSAGES.mismatch)).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("saves, confirms, and opens the role dashboard", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/^New password/), "abcdefg1!");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefg1!");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "abcdefg1!" });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_password_change");
    expect(await screen.findByText("Student home", undefined, { timeout: 4000 })).toBeVisible();
    expect(replaceSpy).not.toHaveBeenCalled();
  }, 10000);

  it("opens the admin area for an admin", async () => {
    const user = userEvent.setup();
    renderPage(authValue({ ...STUDENT, role: "admin", adminLevel: "school_admin" }));
    await user.type(screen.getByLabelText(/^New password/), "abcdefg1!");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefg1!");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
    expect(await screen.findByText("Admin home", undefined, { timeout: 4000 })).toBeVisible();
  }, 10000);

  it("loads the dashboard afresh when the profile is not read again", async () => {
    vi.useFakeTimers();
    try {
      mocks.refreshSession.mockResolvedValue({ data: {}, error: null });
      renderPage();
      fireEvent.change(screen.getByLabelText(/^New password/), {
        target: { value: "abcdefg1!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
        target: { value: "abcdefg1!" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Set password and continue" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByText(/Password saved/)).toBeVisible();
      expect(replaceSpy).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(replaceSpy).toHaveBeenCalledWith("/student");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the failure message and keeps the form when saving fails", async () => {
    const user = userEvent.setup();
    mocks.updateUser.mockResolvedValue({ data: {}, error: { status: 400, code: "other" } });
    renderPage();
    await user.type(screen.getByLabelText(/^New password/), "abcdefg1!");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefg1!");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
    expect(await screen.findByText(PASSWORD_MESSAGES.failed)).toBeVisible();
    expect(screen.getByRole("button", { name: "Set password and continue" })).toBeVisible();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("sends an ended session back to sign in", async () => {
    const user = userEvent.setup();
    mocks.updateUser.mockResolvedValue({ data: {}, error: { status: 401, code: "bad_jwt" } });
    renderPage();
    await user.type(screen.getByLabelText(/^New password/), "abcdefg1!");
    await user.type(screen.getByLabelText(/^Confirm new password/), "abcdefg1!");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
    expect(await screen.findByText("Login route")).toBeVisible();
  });

  it("signs out and goes to /login", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOut).toHaveBeenCalled();
    expect(await screen.findByText("Login route")).toBeVisible();
  });

  it("redirects a visitor who is not signed in to /login", () => {
    renderPage(authValue(null));
    expect(screen.getByText("Login route")).toBeVisible();
  });

  it("redirects an account that does not need the change to its dashboard", () => {
    renderPage(authValue({ ...STUDENT, mustChangePassword: false }));
    expect(screen.getByText("Student home")).toBeVisible();
  });

  it("waits while the session loads", () => {
    renderPage(authValue(null, { isLoading: true }));
    const status = screen.getByRole("status");
    expect(within(status).getByText(/Loading your account/)).toBeVisible();
  });
});
