import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("canvas-confetti", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import { WorldProvider } from "./WorldProvider";
import { ThemeProvider } from "./ThemeProvider";
import { useWorld, useTheme, WORLD_STORAGE_KEY, THEME_STORAGE_KEY } from "@/shared/hooks/useWorld";
import { EffectsProvider } from "./EffectsProvider";
import { useEffectsTier } from "@/shared/hooks/useEffectsTier";
import { SoundProvider } from "./SoundProvider";
import { useSound } from "@/shared/hooks/useSound";
import { CelebrationProvider, useCelebration } from "./CelebrationProvider";

describe("UIK-01: WorldProvider, ThemeProvider, and useWorld", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-world");
    document.documentElement.removeAttribute("data-world-morph");
    document.getElementById("alhikmah-world-runtime")?.remove();
  });

  function WorldConsumer() {
    const { world, worlds, setWorld } = useWorld();
    return (
      <div>
        <span data-testid="active-world">{world}</span>
        <span data-testid="world-count">{worlds.length}</span>
        <button onClick={() => setWorld("coral")}>Set Coral</button>
        <button onClick={() => setWorld("mint")}>Set Mint</button>
      </div>
    );
  }

  it("sets data-world on root document element and switches world", async () => {
    const user = userEvent.setup();
    const onWorldChange = vi.fn();

    render(
      <WorldProvider onWorldChange={onWorldChange}>
        <WorldConsumer />
      </WorldProvider>,
    );

    expect(document.documentElement.getAttribute("data-world")).toBe("amber");
    expect(screen.getByTestId("active-world")).toHaveTextContent("amber");

    await user.click(screen.getByText("Set Coral"));
    expect(document.documentElement.getAttribute("data-world")).toBe("coral");
    expect(screen.getByTestId("active-world")).toHaveTextContent("coral");
    expect(localStorage.getItem(WORLD_STORAGE_KEY)).toBe("coral");
    expect(onWorldChange).toHaveBeenCalledWith("coral");
  });

  it("prioritizes profileWorld prop over localStorage", () => {
    localStorage.setItem(WORLD_STORAGE_KEY, "sky");

    render(
      <WorldProvider profileWorld="rose">
        <WorldConsumer />
      </WorldProvider>,
    );

    expect(screen.getByTestId("active-world")).toHaveTextContent("rose");
    expect(document.documentElement.getAttribute("data-world")).toBe("rose");
  });

  function ThemeConsumer() {
    const { theme, themes, setTheme } = useTheme();
    return (
      <div>
        <span data-testid="active-theme">{theme.id}</span>
        <span data-testid="theme-count">{themes.length}</span>
        <button onClick={() => setTheme("sorbet")}>Set Sorbet</button>
      </div>
    );
  }

  it("mounts ThemeProvider and sets CSS custom properties", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();

    render(
      <ThemeProvider onThemeChange={onThemeChange}>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(document.getElementById("alhikmah-world-runtime")).not.toBeNull();
    expect(screen.getByTestId("active-theme")).toHaveTextContent("candy-pop");

    await user.click(screen.getByText("Set Sorbet"));
    expect(screen.getByTestId("active-theme")).toHaveTextContent("sorbet");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("sorbet");
    expect(onThemeChange).toHaveBeenCalledWith("sorbet");
  });
});

describe("UIK-02: EffectsProvider and useEffectsTier", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-effects-tier");
    document.getElementById("alhikmah-effects-runtime")?.remove();
  });

  function EffectsConsumer() {
    const { tier, prefersReducedMotion, canRender3D, canAnimateComplex } = useEffectsTier();
    return (
      <div>
        <span data-testid="fx-tier">{tier}</span>
        <span data-testid="fx-reduced">{String(prefersReducedMotion)}</span>
        <span data-testid="fx-3d">{String(canRender3D)}</span>
        <span data-testid="fx-complex">{String(canAnimateComplex)}</span>
      </div>
    );
  }

  it("sets data-effects-tier on html root element", () => {
    render(
      <EffectsProvider>
        <EffectsConsumer />
      </EffectsProvider>,
    );

    const tier = document.documentElement.getAttribute("data-effects-tier");
    expect(tier).toBeDefined();
    expect(["low", "balanced", "high"]).toContain(tier);
    expect(document.getElementById("alhikmah-effects-runtime")).not.toBeNull();
  });

  it("respects prefers-reduced-motion media query", () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <EffectsProvider>
        <EffectsConsumer />
      </EffectsProvider>,
    );

    expect(screen.getByTestId("fx-reduced")).toHaveTextContent("true");
    expect(screen.getByTestId("fx-tier")).toHaveTextContent("low");
    expect(screen.getByTestId("fx-3d")).toHaveTextContent("false");
    expect(screen.getByTestId("fx-complex")).toHaveTextContent("false");

    matchMediaSpy.mockRestore();
  });
});

describe("UIK-03: SoundProvider and useSound", () => {
  afterEach(() => {
    localStorage.clear();
  });

  function SoundConsumer() {
    const { volume, setVolume, muted, toggleMute, play } = useSound();
    return (
      <div>
        <span data-testid="sound-volume">{volume}</span>
        <span data-testid="sound-muted">{String(muted)}</span>
        <button onClick={() => setVolume(0.5)}>Set Vol 0.5</button>
        <button onClick={toggleMute}>Toggle Mute</button>
        <button onClick={() => play("click")}>Play Click</button>
      </div>
    );
  }

  it("manages volume, mute state, and localStorage persistence", async () => {
    const user = userEvent.setup();

    render(
      <SoundProvider>
        <SoundConsumer />
      </SoundProvider>,
    );

    expect(screen.getByTestId("sound-volume")).toHaveTextContent("0.35");
    expect(screen.getByTestId("sound-muted")).toHaveTextContent("false");

    await user.click(screen.getByText("Set Vol 0.5"));
    expect(screen.getByTestId("sound-volume")).toHaveTextContent("0.5");

    await user.click(screen.getByText("Toggle Mute"));
    expect(screen.getByTestId("sound-muted")).toHaveTextContent("true");

    // play should not throw
    expect(() => screen.getByText("Play Click").click()).not.toThrow();
  });
});

describe("UIK-28: CelebrationProvider, CelebrationDialog, and useCelebration", () => {
  function CelebrationConsumer() {
    const { celebrate, dismiss } = useCelebration();
    return (
      <div>
        <button onClick={() => celebrate({ tier: "small", title: "Small Win" })}>
          Trigger Small
        </button>
        <button
          onClick={() =>
            celebrate({ tier: "medium", title: "Level Up Banner", description: "Streak 5 days" })
          }
        >
          Trigger Medium
        </button>
        <button
          onClick={() =>
            celebrate({
              tier: "large",
              title: "Level 10 Reached!",
              description: "Master Rank",
              rewards: [{ label: "XP", value: "+500" }],
            })
          }
        >
          Trigger Large
        </button>
        <button onClick={dismiss}>Dismiss</button>
      </div>
    );
  }

  it("displays medium celebration banner and allows dismissing", async () => {
    const user = userEvent.setup();

    render(
      <EffectsProvider>
        <SoundProvider>
          <CelebrationProvider>
            <CelebrationConsumer />
          </CelebrationProvider>
        </SoundProvider>
      </EffectsProvider>,
    );

    await user.click(screen.getByText("Trigger Medium"));
    expect(screen.getByText("Level Up Banner")).toBeInTheDocument();
    expect(screen.getByText("Streak 5 days")).toBeInTheDocument();

    await user.click(screen.getByText("Dismiss"));
    expect(screen.queryByText("Level Up Banner")).not.toBeInTheDocument();
  });

  it("displays large celebration modal with rewards", async () => {
    const user = userEvent.setup();

    render(
      <EffectsProvider>
        <SoundProvider>
          <CelebrationProvider>
            <CelebrationConsumer />
          </CelebrationProvider>
        </SoundProvider>
      </EffectsProvider>,
    );

    await user.click(screen.getByText("Trigger Large"));
    expect(screen.getByText("Level 10 Reached!")).toBeInTheDocument();
    expect(screen.getByText("Master Rank")).toBeInTheDocument();
    expect(screen.getByText("XP")).toBeInTheDocument();
    expect(screen.getByText("+500")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByText("Master Rank")).not.toBeInTheDocument();
  });
});
