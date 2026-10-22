import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import ForgotPasswordPage from "./index";
import {
  DEVICE_KEY_STORAGE_KEY,
  RATE_LIMIT_STORAGE_KEY,
  RESET_MESSAGES,
  isDeviceRateLimited,
  recordDeviceRequest,
  validateReset,
} from "./forgot-password-logic";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
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

const SCHOOL_STATE = {
  school: {
    name: "Al Hikmah School",
    contact_email: "helpdesk@alhikmah.example",
    contact_phone: "+218 21 000 0000",
    office_hours: "Sun to Thu, 8:00 to 14:00",
    location: "Main building, room 12",
  },
};

function renderPage(auth: AuthContextValue = defaultAuthContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SoundContext.Provider value={sound}>
          <MemoryRouter initialEntries={["/forgot-password"]}>
            <Routes>
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/login" element={<p>Login route</p>} />
              <Route path="/student" element={<p>Student home</p>} />
            </Routes>
          </MemoryRouter>
        </SoundContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Username/), "sara.k");
  await user.type(screen.getByLabelText(/^Full name/), "Sara Khaled");
}

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

/** One mock serves both calls the page makes: the school details and the reset request. */
function stubRpc(options: { publicState?: unknown; reset?: RpcResult }) {
  mocks.rpc.mockImplementation((fn: string) => {
    if (fn === "get_public_state") {
      return Promise.resolve({ data: options.publicState ?? SCHOOL_STATE, error: null });
    }
    return Promise.resolve(options.reset ?? { data: { ok: true }, error: null });
  });
}

function resetCalls() {
  return mocks.rpc.mock.calls.filter((call) => call[0] === "request_password_reset");
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stubRpc({ publicState: SCHOOL_STATE, reset: { data: { ok: true }, error: null } });
});

describe("validateReset", () => {
  it("requires a username and a full name", () => {
    const errors = validateReset({ username: " ", fullName: "", gradeClass: "", note: "" });
    expect(errors.username).toBe("Enter your username.");
    expect(errors.fullName).toBe("Enter your full name.");
    expect(errors.gradeClass).toBeUndefined();
    expect(errors.note).toBeUndefined();
  });

  it("limits the note to 200 characters and checks the grade and class", () => {
    const errors = validateReset({
      username: "sara.k",
      fullName: "Sara Khaled",
      gradeClass: "8B!!",
      note: "x".repeat(201),
    });
    expect(errors.note).toMatch(/200/);
    expect(errors.gradeClass).toBeDefined();
  });
});

describe("device rate limit", () => {
  it("blocks after 3 requests in the last hour and forgets older ones", () => {
    const now = 10_000_000_000;
    recordDeviceRequest(now - 2 * 60 * 60 * 1000);
    recordDeviceRequest(now - 1000);
    recordDeviceRequest(now - 500);
    expect(isDeviceRateLimited(now)).toBe(false);
    recordDeviceRequest(now);
    expect(isDeviceRateLimited(now)).toBe(true);
  });

  it("ignores bad stored data", () => {
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, "not json");
    expect(isDeviceRateLimited()).toBe(false);
  });
});

describe("device key", () => {
  it("keeps one id for the device", async () => {
    const { getDeviceKey } = await import("./forgot-password-logic");
    const first = getDeviceKey();
    expect(first).not.toBe("");
    expect(window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY)).toBe(first);
    expect(getDeviceKey()).toBe(first);
  });
});

describe("ForgotPasswordPage", () => {
  it("shows the form, the contact card and a link back to sign in", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Request a reset" })).toBeVisible();
    expect(await screen.findByText("helpdesk@alhikmah.example")).toBeVisible();
    expect(screen.getByText("Sun to Thu, 8:00 to 14:00")).toBeVisible();
    expect(screen.getByText("Main building, room 12")).toBeVisible();
    expect(screen.getByText(/Students/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows field errors and sends nothing when required fields are empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Enter your username.")).toBeVisible();
    expect(screen.getByText("Enter your full name.")).toBeVisible();
    expect(resetCalls()).toHaveLength(0);
  });

  it("sends the request and replaces the form with the confirmation banner", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.type(screen.getByLabelText(/^Grade and class/), "8B");
    await user.type(screen.getByLabelText(/^Note/), "Locked out");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("request_password_reset", {
        p_username: "sara.k",
        p_full_name: "Sara Khaled",
        p_grade_class: "8B",
        p_note: "Locked out",
        p_device_key: expect.any(String) as string,
      });
    });
    expect(
      await screen.findByText(
        "Request sent. Your school will contact you with a temporary password. This can take up to 2 school days.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByText("Login route")).toBeVisible();
  });

  it("sends null for the optional fields left empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("request_password_reset", {
        p_username: "sara.k",
        p_full_name: "Sara Khaled",
        p_grade_class: null,
        p_note: null,
        p_device_key: expect.any(String) as string,
      });
    });
  });

  it("shows the rate limit message when the server answers rate_limited", async () => {
    const user = userEvent.setup();
    stubRpc({ reset: { data: null, error: { message: "rate_limited" } } });
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(RESET_MESSAGES.rateLimited)).toBeVisible();
    expect(screen.getByLabelText(/^Username/)).toHaveValue("sara.k");
  });

  it("blocks a fourth request from the same device without calling the server", async () => {
    const user = userEvent.setup();
    recordDeviceRequest();
    recordDeviceRequest();
    recordDeviceRequest();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(RESET_MESSAGES.rateLimited)).toBeVisible();
    expect(resetCalls()).toHaveLength(0);
  });

  it("shows a network message and keeps the form when the server cannot be reached", async () => {
    const user = userEvent.setup();
    stubRpc({ reset: { data: null, error: { message: "TypeError: Failed to fetch" } } });
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(RESET_MESSAGES.network)).toBeVisible();
    expect(screen.getByRole("button", { name: "Send request" })).toBeVisible();
  });

  it("shows a general failure message for other server errors", async () => {
    const user = userEvent.setup();
    stubRpc({ reset: { data: null, error: { message: "validation_failed" } } });
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(RESET_MESSAGES.failed)).toBeVisible();
  });

  it("leaves out contact details that are not set", async () => {
    stubRpc({ publicState: { school: { name: "Al Hikmah School" } } });
    renderPage();
    expect(await screen.findByText(/Contact details have not been added yet/)).toBeVisible();
    expect(screen.queryByText("Office hours")).not.toBeInTheDocument();
  });

  it("redirects a signed-in visitor to their dashboard", () => {
    renderPage({
      ...defaultAuthContext,
      isAuthenticated: true,
      user: { ...(defaultAuthContext.user ?? {}), role: "student" } as AuthContextValue["user"],
    });
    expect(screen.getByText("Student home")).toBeVisible();
  });
});
