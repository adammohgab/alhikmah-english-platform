import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ToastContext } from "@/app/providers/toast-context";
import type { ToastContextValue } from "@/app/providers/toast-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}));

import HelpContactPage from "./index";
import { parseSchoolContact, safeHttpUrl } from "./school-contact";
import { validateInquiry } from "./inquiry";

// Radix Select needs these pointer and scroll APIs, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

const show = vi.fn().mockReturnValue("t1");
const toast: ToastContextValue = { show, dismiss: vi.fn(), dismissAll: vi.fn(), toasts: [] };
const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

const PUBLIC_STATE = {
  school: {
    name: "Test School",
    contact: {
      office_hours: "Sun to Thu, 8:00 to 14:00",
      phone: "+218 21 000 0000",
      email: "office@test.example",
      location: "1 Example Street, Tripoli",
      support_link: "https://support.test.example/help",
    },
  },
};

function renderAt(entry = "/help") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter initialEntries={[entry]}>
            <HelpContactPage />
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /Your name/ }), "Sara Ali");
  await user.type(screen.getByRole("textbox", { name: /Student ID/ }), "8B");
  await user.click(screen.getByRole("combobox", { name: /What is it about/ }));
  await user.click(await screen.findByRole("option", { name: "I cannot sign in" }));
  await user.type(
    screen.getByRole("textbox", { name: /Your message/ }),
    "I typed my username correctly but it still fails.",
  );
}

describe("PUB-08: HelpContactPage (SH-06)", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
    show.mockClear();
    mocks.rpc.mockResolvedValue({ data: PUBLIC_STATE, error: null });
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it("shows the official contact channels, hours and campus from platform settings", async () => {
    renderAt();
    expect(await screen.findByText("Sun to Thu, 8:00 to 14:00")).toBeInTheDocument();
    expect(screen.getByText("Test School")).toBeInTheDocument();
    expect(screen.getByText("+218 21 000 0000")).toBeInTheDocument();
    expect(screen.getByText("office@test.example")).toBeInTheDocument();
    expect(screen.getByText("1 Example Street, Tripoli")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in maps/ })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("1 Example Street, Tripoli")),
    );
    expect(document.title).toBe("Help and contact | Wordland");
  });

  it("leaves out what the school has not set and invents nothing", async () => {
    mocks.rpc.mockResolvedValue({
      data: { school: { name: "Test School", contact: {} } },
      error: null,
    });
    renderAt();
    expect(await screen.findByText(/Contact details have not been added yet/)).toBeInTheDocument();
    expect(screen.queryByText("Campus")).not.toBeInTheDocument();
  });

  it("still renders the help content if the contact lookup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    renderAt();
    expect(
      await screen.findByText(/Contact details have not been added yet/, undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common problems" })).toBeInTheDocument();
  });

  it("has the spec sections and links to the related pages", () => {
    renderAt();
    for (const name of [
      "Contact the school",
      "Send a message",
      "Who should I ask?",
      "Common problems",
      "Browser and device tips",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText("Your teacher first, then the school office.")).toBeInTheDocument();
    const problems = screen.getByRole("region", { name: "Common problems" });
    expect(
      within(problems).getByRole("link", { name: "Request a password reset" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(within(problems).getByRole("link", { name: "See what to do" })).toHaveAttribute(
      "href",
      "/account-not-active",
    );
  });

  it("validates with helpful hints and focuses the first problem on submit", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Choose what your message is about.")).toBeInTheDocument();
    expect(screen.getByText("Write your message.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveFocus();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("checks fields when they are left, with specific messages", async () => {
    const user = userEvent.setup();
    renderAt();
    const message = screen.getByRole("textbox", { name: /Your message/ });
    await user.type(message, "short");
    await user.tab();
    expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Student ID/ }), "8B!!");
    await user.tab();
    expect(await screen.findByText(/Use letters, numbers, spaces/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your message/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("sends a valid message, confirms it with a toast and a message, and resets the form", async () => {
    const user = userEvent.setup();
    renderAt();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenCalledWith("submit_inquiry", {
      body: {
        name: "Sara Ali",
        student_ref: "8B",
        category: "sign-in",
        message: "I typed my username correctly but it still fails.",
      },
    });
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Message sent" }),
    );
    expect(await screen.findByText(/Message sent\. Thank you/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Your message/ })).toHaveValue("");
    expect(screen.queryByText("Enter your name.")).not.toBeInTheDocument();
  });

  it("says so, and keeps the text, when the message could not be sent", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("down") });
    renderAt();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send your message/);
    expect(show).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Sara Ali");
  });

  it("opens the form pre-filled from an error report link", () => {
    renderAt("/help?errorId=ERR-ABC12-9Z9Z");
    expect(screen.getByRole("textbox", { name: /Your message/ })).toHaveValue(
      "Error ID: ERR-ABC12-9Z9Z\n\nWhat I was doing: ",
    );
    expect(screen.getByRole("combobox", { name: /What is it about/ })).toHaveTextContent(
      "Report a problem",
    );
  });

  it("ignores a malformed error id in the link", () => {
    renderAt("/help?errorId=<script>");
    expect(screen.getByRole("textbox", { name: /Your message/ })).toHaveValue("");
  });

  it("the Sections toggle opens and closes the contents on small screens", async () => {
    const user = userEvent.setup();
    renderAt();
    const toggle = screen.getByRole("button", { name: "Sections" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("help page helpers", () => {
  it("only accepts http(s) links", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });

  it("reads both the nested and the flat contact shapes", () => {
    expect(
      parseSchoolContact({ school: { name: "A", contact_phone: "1", contact_email: "e@x" } }),
    ).toMatchObject({
      schoolName: "A",
      phone: "1",
      contactEmail: "e@x",
    });
    expect(parseSchoolContact(null)).toEqual({});
    expect(
      parseSchoolContact({ school: { contact: { support_link: "javascript:x" } } }).supportLink,
    ).toBeUndefined();
  });

  it("validates inquiry values", () => {
    expect(validateInquiry({ name: "", studentRef: "", category: "", message: "" })).toEqual({
      name: "Enter your name.",
      category: "Choose what your message is about.",
      message: "Write your message.",
    });
    expect(
      validateInquiry({
        name: "Sara",
        studentRef: "",
        category: "other",
        message: "x".repeat(1001),
      }).message,
    ).toMatch(/under 1000/);
    expect(
      validateInquiry({
        name: "Sara",
        studentRef: "",
        category: "other",
        message: "Hello there, school.",
      }),
    ).toEqual({});
  });
});
