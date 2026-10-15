import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ErrorBoundary, ErrorFallback } from "./index";
import { createErrorId } from "./error-id";

/** Throws while `shouldThrow.current` is true, so a retry can succeed or fail on demand. */
const shouldThrow = { current: true };
function Bomb() {
  if (shouldThrow.current) throw new Error("kaboom: secret table users_private");
  return <p>All good now</p>;
}

describe("PUB-13: ErrorBoundary and ErrorFallback (SH-11)", () => {
  beforeEach(() => {
    shouldThrow.current = true;
    // React logs every caught render error; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("catches a render error and shows the fallback instead of crashing", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong." })).toBeInTheDocument();
    expect(
      screen.getByText("It is on our side. Your work is not lost if it was saved."),
    ).toBeInTheDocument();
    expect(screen.getByText(/^ERR-[0-9A-Z]+-[0-9A-Z]{4}$/)).toBeInTheDocument();
    expect(screen.getByText(/Share this with your school/)).toBeInTheDocument();
  });

  it("reports the error with its Error ID", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, errorId] = onError.mock.calls[0] as [Error, string];
    expect(error.message).toContain("kaboom");
    expect(screen.getByText(errorId)).toBeInTheDocument();
  });

  it("Try again resets the boundary and renders the children again", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Bomb />
      </ErrorBoundary>,
    );
    shouldThrow.current = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("All good now")).toBeInTheDocument();
  });

  it("offers a full reload when the retry throws again", async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("heading", { name: "Something went wrong." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("goes back to Try again after a retry that worked and then crashes later", async () => {
    const user = userEvent.setup();
    function Switch() {
      const [crash, setCrash] = useState(false);
      if (crash) throw new Error("later");
      return (
        <button type="button" onClick={() => setCrash(true)}>
          crash later
        </button>
      );
    }
    shouldThrow.current = false;
    render(
      <ErrorBoundary>
        <Switch />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: "crash later" }));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "crash later" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "crash later" }));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("links to the home page when signed out and to Help for reporting", () => {
    render(<ErrorFallback error={new Error("x")} errorId="ERR-TEST-0001" />);
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/$/),
    );
    expect(screen.getByRole("link", { name: "Report issue" })).toHaveAttribute(
      "href",
      expect.stringContaining("/help?errorId=ERR-TEST-0001"),
    );
  });

  it("copies the Error ID, and says so when the clipboard is blocked", async () => {
    const user = userEvent.setup();
    render(<ErrorFallback error={new Error("x")} errorId="ERR-TEST-0002" />);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "Copy Error ID" }));
    expect(writeText).toHaveBeenCalledWith("ERR-TEST-0002");
    expect(await screen.findByText("Error ID copied.")).toBeInTheDocument();

    writeText.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Copy Error ID" }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });

  it("shows the stack only in development builds", () => {
    vi.stubEnv("DEV", true);
    const { unmount } = render(
      <ErrorFallback error={new Error("kaboom secret")} errorId="ERR-TEST-0003" />,
    );
    expect(screen.getByText(/Developer details/)).toBeInTheDocument();
    expect(screen.getByText("Error: kaboom secret", { selector: "p" })).toBeInTheDocument();
    unmount();

    vi.stubEnv("DEV", false);
    render(<ErrorFallback error={new Error("kaboom secret")} errorId="ERR-TEST-0003" />);
    expect(screen.queryByText(/Developer details/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kaboom secret/)).not.toBeInTheDocument();
  });

  it("creates distinct, well-formed Error IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createErrorId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^ERR-[0-9A-Z]{1,5}-[0-9A-Z]{4}$/);
  });
});
