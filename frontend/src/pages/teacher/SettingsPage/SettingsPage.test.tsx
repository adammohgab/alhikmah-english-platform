import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import SettingsPage from "./index";

const upsert = vi.fn<(values: Record<string, unknown>, options: unknown) => Promise<unknown>>();
const invoke = vi.fn<(name: string, options: unknown) => Promise<unknown>>();
let stored: Record<string, unknown> | null = null;

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: (table: string) =>
      table === "user_settings"
        ? {
            select: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: stored, error: null }) }),
            }),
            upsert: (values: Record<string, unknown>, options: unknown) => upsert(values, options),
          }
        : { update: () => ({ eq: () => Promise.resolve({ error: null }) }) },
    functions: { invoke: (name: string, options: unknown) => invoke(name, options) },
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
const toast: ToastContextValue = {
  show: vi.fn(() => "t"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};
const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "t1",
    username: "rana",
    fullName: "Rana Teacher",
    role: "teacher",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SoundContext.Provider value={sound}>
          <ToastContext.Provider value={toast}>
            <MemoryRouter>
              <SettingsPage />
            </MemoryRouter>
          </ToastContext.Provider>
        </SoundContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("SettingsPage (TC-29)", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ error: null });
    invoke.mockReset();
    stored = { teacher_prefs: { thresholds: { inactive_days: 5 } }, notification_prefs: null };
  });

  it("saves the grading scale and keeps keys written elsewhere", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Grading defaults" }));
    await userEvent.click(await screen.findByRole("tab", { name: /Letter grade/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(upsert).toHaveBeenCalled());
    const saved = upsert.mock.calls[0]?.[0] as {
      user_id: string;
      teacher_prefs: Record<string, unknown>;
    };
    expect(saved.user_id).toBe("t1");
    expect(saved.teacher_prefs).toMatchObject({
      thresholds: { inactive_days: 5 },
      grading: { scale: "letter" },
    });
  });

  it("disables Save until something changes", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("changes the password through the secure function and reports server rule failures", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ details: { rules_failed: ["Use at least 10 characters."] } }),
          { status: 400 },
        ),
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Security" }));
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await userEvent.type(await screen.findByLabelText("Current password"), "old-pass");
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "short");
    await userEvent.click(screen.getAllByRole("button", { name: "Change password" }).at(-1)!);
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("auth_change_password", {
      body: { current_password: "old-pass", new_password: "short" },
    });
  });

  it("rejects mismatched passwords without calling the server", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Security" }));
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await userEvent.type(await screen.findByLabelText("Current password"), "old-pass");
    await userEvent.type(screen.getByLabelText("New password"), "abcdefghijk");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "different");
    await userEvent.click(screen.getAllByRole("button", { name: "Change password" }).at(-1)!);
    expect(await screen.findByText("The new passwords do not match.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
