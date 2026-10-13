import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./toast-context";

function TestConsumer() {
  const { show, dismissAll } = useToast();
  return (
    <div>
      <button
        onClick={() =>
          show({
            title: "Success Title",
            description: "Success description details",
            type: "success",
            duration: 3000,
          })
        }
      >
        Trigger Success
      </button>
      <button
        onClick={() =>
          show({
            title: "Error Title",
            type: "error",
            duration: 0,
          })
        }
      >
        Trigger Error
      </button>
      <button
        onClick={() =>
          show({
            title: "Reward Earned",
            type: "reward",
          })
        }
      >
        Trigger Reward
      </button>
      <button onClick={() => show("Simple Toast Message")}>Trigger Simple</button>
      <button onClick={dismissAll}>Dismiss All</button>
    </div>
  );
}

describe("ToastProvider and useToast", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws error when useToast is used outside of ToastProvider", () => {
    // Suppress console.error from React boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<TestConsumer />)).toThrow("useToast must be used within a ToastProvider");
    spy.mockRestore();
  });

  it("renders toast with title, description, and status role on click", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Trigger Success"));

    expect(screen.getByText("Success Title")).toBeInTheDocument();
    expect(screen.getByText("Success description details")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error toast with role=alert", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Trigger Error"));

    expect(screen.getByText("Error Title")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("supports string parameter for show()", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Trigger Simple"));

    expect(screen.getByText("Simple Toast Message")).toBeInTheDocument();
  });

  it("dismisses toast when clicking close button", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Trigger Simple"));
    expect(screen.getByText("Simple Toast Message")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Dismiss toast" });
    await user.click(closeBtn);

    expect(screen.queryByText("Simple Toast Message")).not.toBeInTheDocument();
  });

  it("dismisses all toasts when pressing Escape key", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Trigger Success"));
    await user.click(screen.getByText("Trigger Error"));
    expect(screen.getByText("Success Title")).toBeInTheDocument();
    expect(screen.getByText("Error Title")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Success Title")).not.toBeInTheDocument();
    expect(screen.queryByText("Error Title")).not.toBeInTheDocument();
  });

  it("auto-dismisses toast after duration expires", () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Trigger Success").click();
    });

    expect(screen.getByText("Success Title")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Success Title")).not.toBeInTheDocument();
  });
});
