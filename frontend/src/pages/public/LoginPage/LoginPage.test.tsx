import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import LoginPage from "./index";
import {
  LOGIN_MESSAGES,
  REMEMBER_STORAGE_KEY,
  classifyAuthError,
  resolveRedirect,
  usernameToEmail,
  validateLogin,
} from "./login-logic";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  maintenance: { enabled: false, message: "We will be back soon." },
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  },
}));

vi.mock("@/shared/hooks/usePlatformSettings", () => ({
  usePlatformSettings: () => ({ settings: { maintenance: mocks.maintenance } }),
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

const signedIn = { data: { user: { id: "user-1" }, session: {} }, error: null };

function profileOf(role: string, status = "active", mustChangePassword = false) {
  return {
    data: { role, status, must_change_password: mustChangePassword },
    error: null,
  };
}

function authError(overrides: Record<string, unknown> = {}) {
  return {
    data: { user: null, session: null },
    error: {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
      ...overrides,
    },
  };
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

function renderLogin(entry = "/login", auth: AuthContextValue = defaultAuthContext) {
  return render(
    <SoundContext.Provider value={sound}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundContext.Provider>,
  );
}

const usernameField = () => screen.getByLabelText(/^Username/);
const passwordField = () => screen.getByLabelText(/^Password/);
const submitButton = () => screen.getByRole("button", { name: "Sign in" });

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  username: string,
  password: string,
) {
  await user.type(usernameField(), username);
  await user.type(passwordField(), password);
  await user.click(submitButton());
}

describe("PUB-04: LoginPage (SH-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.maintenance.enabled = false;
    mocks.signInWithPassword.mockResolvedValue(signedIn);
    mocks.maybeSingle.mockResolvedValue(profileOf("student"));
    mocks.signOut.mockResolvedValue({ error: null });
  });

  describe("layout", () => {
    it("shows the title, both fields, the remember box and the help links", () => {
      renderLogin();

      expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByText("Use the username and password from your school.")).toBeVisible();
      expect(usernameField()).toHaveAttribute("autocomplete", "username");
      expect(usernameField()).toHaveAttribute("autocapitalize", "none");
      expect(passwordField()).toHaveAttribute("autocomplete", "current-password");
      expect(passwordField()).toHaveAttribute("type", "password");
      expect(
        screen.getByRole("checkbox", { name: "Keep me signed in on this device" }),
      ).not.toBeChecked();
      expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
        "href",
        "/forgot-password",
      );
      expect(screen.getByRole("link", { name: "Need help?" })).toHaveAttribute("href", "/help");
      expect(screen.getByText("Accounts are created by your school.")).toBeVisible();
      expect(document.title).toBe("Sign in | Al Hikmah English Platform");
    });

    it("shows or hides the password with a toggle button", async () => {
      const user = userEvent.setup();
      renderLogin();

      const toggle = screen.getByRole("button", { name: "Show password" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await user.click(toggle);

      expect(passwordField()).toHaveAttribute("type", "text");
      expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(screen.getByRole("button", { name: "Hide password" }));
      expect(passwordField()).toHaveAttribute("type", "password");
    });

    it("warns when Caps Lock is on in the password field", () => {
      renderLogin();

      fireEvent.keyDown(passwordField(), { key: "A", modifierCapsLock: true });
      expect(screen.getByText("Caps Lock is on.")).toBeInTheDocument();

      fireEvent.blur(passwordField());
      expect(screen.queryByText("Caps Lock is on.")).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("asks for both fields on submit and does not call the server", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(submitButton());

      expect(screen.getByText("Enter your username.")).toBeInTheDocument();
      expect(screen.getByText("Enter your password.")).toBeInTheDocument();
      expect(usernameField()).toHaveFocus();
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it("validates a field when it loses focus", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(usernameField());
      await user.tab();

      expect(await screen.findByText("Enter your username.")).toBeInTheDocument();
    });

    it("rejects a short password and an invalid username", async () => {
      const user = userEvent.setup();
      renderLogin();

      await fillAndSubmit(user, "a!", "abc");

      expect(screen.getByText(LOGIN_MESSAGES.usernameInvalid)).toBeInTheDocument();
      expect(screen.getByText(LOGIN_MESSAGES.passwordShort)).toBeInTheDocument();
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("signing in", () => {
    it("submits with Enter, trimming and lowercasing the username", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(usernameField(), "  Student.One ");
      await user.type(passwordField(), "secret1{Enter}");

      await waitFor(() => {
        expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
      });
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "student.one@accounts.invalid",
        password: "secret1",
      });
    });

    it.each([
      ["student", "/student"],
      ["teacher", "/teacher"],
      ["admin", "/admin"],
    ])("sends a %s to %s", async (role, path) => {
      const user = userEvent.setup();
      mocks.maybeSingle.mockResolvedValue(profileOf(role));
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect(await screen.findByTestId("where")).toHaveTextContent(path);
      expect(screen.getByTestId("where").textContent).toBe(path);
    });

    it("goes to the requested page when it is inside the role area", async () => {
      const user = userEvent.setup();
      renderLogin("/login?redirect=%2Fstudent%2Fcourses");

      await fillAndSubmit(user, "someone", "secret1");

      expect((await screen.findByTestId("where")).textContent).toBe("/student/courses");
    });

    it("ignores a requested page from another area or another site", async () => {
      const user = userEvent.setup();
      renderLogin("/login?next=%2Fteacher%2Fclasses");

      await fillAndSubmit(user, "someone", "secret1");

      expect((await screen.findByTestId("where")).textContent).toBe("/student");
    });

    it("sends a locked account to /account-not-active and ends the session", async () => {
      const user = userEvent.setup();
      mocks.maybeSingle.mockResolvedValue(profileOf("student", "locked"));
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect((await screen.findByTestId("where")).textContent).toBe("/account-not-active");
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    });

    it("sends an archived account to /account-not-active too", async () => {
      const user = userEvent.setup();
      mocks.maybeSingle.mockResolvedValue(profileOf("teacher", "archived"));
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect((await screen.findByTestId("where")).textContent).toBe("/account-not-active");
    });

    it("keeps the session and asks for a new password after a temporary one", async () => {
      const user = userEvent.setup();
      mocks.maybeSingle.mockResolvedValue(profileOf("student", "active", true));
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect((await screen.findByTestId("where")).textContent).toBe("/set-new-password");
      expect(mocks.signOut).not.toHaveBeenCalled();
    });

    it("saves the keep-me-signed-in choice", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole("checkbox", { name: "Keep me signed in on this device" }));
      await fillAndSubmit(user, "someone", "secret1");

      await screen.findByTestId("where");
      expect(localStorage.getItem(REMEMBER_STORAGE_KEY)).toBe("1");
    });

    it("disables the form while signing in and ignores a second submit", async () => {
      const user = userEvent.setup();
      let release: (value: unknown) => void = () => undefined;
      mocks.signInWithPassword.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      renderLogin();

      await user.type(usernameField(), "someone");
      await user.type(passwordField(), "secret1{Enter}");

      expect(usernameField()).toBeDisabled();
      expect(passwordField()).toBeDisabled();
      expect(submitButton()).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("status")).toHaveTextContent("Signing in");

      fireEvent.submit(submitButton());
      expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);

      release(authError());
      expect(await screen.findByText(LOGIN_MESSAGES.invalidCredentials)).toBeInTheDocument();
      expect(usernameField()).toBeEnabled();
    });
  });

  describe("failures", () => {
    it("shows one non-revealing message for a wrong password, and clears the password", async () => {
      const user = userEvent.setup();
      mocks.signInWithPassword.mockResolvedValue(authError());
      renderLogin();

      await fillAndSubmit(user, "someone", "wrong-pass");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Username or password is incorrect.",
      );
      expect(mocks.maybeSingle).not.toHaveBeenCalled();
      expect(passwordField()).toHaveValue("");
      expect(usernameField()).toHaveValue("someone");
      await waitFor(() => {
        expect(passwordField()).toHaveFocus();
      });
    });

    it("gives the same message for an unknown username", async () => {
      const user = userEvent.setup();
      mocks.signInWithPassword.mockResolvedValue(authError({ code: "user_not_found" }));
      renderLogin();

      await fillAndSubmit(user, "nobody", "secret1");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Username or password is incorrect.",
      );
    });

    it("explains a network failure", async () => {
      const user = userEvent.setup();
      mocks.signInWithPassword.mockResolvedValue(
        authError({
          name: "AuthRetryableFetchError",
          status: 0,
          code: undefined,
          message: "Failed to fetch",
        }),
      );
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_MESSAGES.network);
    });

    it("explains a thrown request as a network failure", async () => {
      const user = userEvent.setup();
      mocks.signInWithPassword.mockRejectedValue(new Error("boom"));
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_MESSAGES.network);
    });

    it("explains too many attempts", async () => {
      const user = userEvent.setup();
      mocks.signInWithPassword.mockResolvedValue(
        authError({ status: 429, code: "over_request_rate_limit" }),
      );
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_MESSAGES.rateLimited);
    });

    it("ends the session and shows an error when the profile cannot be read", async () => {
      const user = userEvent.setup();
      mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "denied" } });
      renderLogin();

      await fillAndSubmit(user, "someone", "secret1");

      expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_MESSAGES.profile);
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    });
  });

  describe("alerts and redirects on arrival", () => {
    it("shows the session-expired and signed-out messages", () => {
      const first = renderLogin("/login?reason=expired");
      expect(screen.getByRole("status")).toHaveTextContent(
        "You were signed out for security. Sign in again to continue.",
      );
      first.unmount();

      renderLogin("/login?reason=signed-out");
      expect(screen.getByRole("status")).toHaveTextContent("You have signed out.");
    });

    it("warns while the platform is under maintenance, and still allows sign-in", () => {
      mocks.maintenance.enabled = true;
      renderLogin();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "The platform is under maintenance. We will be back soon.",
      );
      expect(submitButton()).not.toBeDisabled();
    });

    it("redirects a signed-in person to their dashboard", async () => {
      renderLogin("/login", {
        ...defaultAuthContext,
        isAuthenticated: true,
        user: {
          id: "user-2",
          username: "teacher.one",
          fullName: "Teacher One",
          role: "teacher",
          adminLevel: null,
          status: "active",
          mustChangePassword: false,
        },
      });

      expect((await screen.findByTestId("where")).textContent).toBe("/teacher");
    });
  });
});

describe("PUB-04: login rules", () => {
  it("normalizes the username and validates both fields", () => {
    const ok = validateLogin({ username: "  Student.One ", password: "secret1", remember: false });
    expect(ok).toEqual({
      success: true,
      data: { username: "student.one", password: "secret1", remember: false },
    });

    const bad = validateLogin({ username: "", password: "", remember: false });
    expect(bad).toEqual({
      success: false,
      errors: {
        username: LOGIN_MESSAGES.usernameRequired,
        password: LOGIN_MESSAGES.passwordRequired,
      },
    });

    expect(validateLogin({ username: "ab", password: "secret1", remember: false })).toMatchObject({
      success: false,
      errors: { username: LOGIN_MESSAGES.usernameInvalid },
    });
  });

  it("builds the internal address from the username", () => {
    expect(usernameToEmail(" Student.One ")).toBe("student.one@accounts.invalid");
  });

  it("accepts a redirect only inside the role area", () => {
    expect(resolveRedirect("/student", "student")).toBe("/student");
    expect(resolveRedirect("/student/courses?x=1", "student")).toBe("/student/courses?x=1");
    expect(resolveRedirect("/student#top", "student")).toBe("/student#top");
    expect(resolveRedirect("/teacher/classes", "student")).toBeNull();
    expect(resolveRedirect("/students", "student")).toBeNull();
    expect(resolveRedirect("//evil.example", "student")).toBeNull();
    expect(resolveRedirect("/student\\..\\x", "student")).toBeNull();
    expect(resolveRedirect("https://evil.example/student", "student")).toBeNull();
    expect(resolveRedirect(null, "student")).toBeNull();
  });

  it("classifies auth errors without describing them", () => {
    expect(classifyAuthError({ status: 400, code: "invalid_credentials" })).toBe(
      "invalid-credentials",
    );
    expect(classifyAuthError({ status: 400, code: "user_not_found" })).toBe("invalid-credentials");
    expect(classifyAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe("network");
    expect(classifyAuthError({ message: "Failed to fetch" })).toBe("network");
    expect(classifyAuthError({ status: 503 })).toBe("network");
    expect(classifyAuthError({ status: 429 })).toBe("rate-limited");
    expect(classifyAuthError({ code: "over_request_rate_limit" })).toBe("rate-limited");
  });
});
