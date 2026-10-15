import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Badge } from "./Badge";
import { Chip } from "./Chip";
import { LevelIndicator } from "./LevelIndicator";
import { ShapeFrame, buildShapePath } from "./ShapeFrame";
import { Sticker } from "./Sticker";
import { Squiggle } from "./Squiggle";
import { Card } from "./Card";
import { Surface } from "./Surface";
import { Avatar } from "./Avatar";
import { LevelRing } from "./LevelRing";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";

const mockSoundValue: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function renderWithSound(ui: React.ReactElement) {
  return render(<SoundContext.Provider value={mockSoundValue}>{ui}</SoundContext.Provider>);
}

describe("UIK-04: Button and IconButton primitives", () => {
  it("renders button variants and sizes", () => {
    const { rerender } = renderWithSound(
      <Button variant="primary" size="md">
        Click Me
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();

    rerender(
      <SoundContext.Provider value={mockSoundValue}>
        <Button variant="danger" size="pill">
          Danger Pill
        </Button>
      </SoundContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Danger Pill" })).toHaveClass("rounded-full");

    rerender(
      <SoundContext.Provider value={mockSoundValue}>
        <Button variant="secondary" size="lg">
          Secondary Large
        </Button>
      </SoundContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Secondary Large" })).toBeInTheDocument();
  });

  it("handles loading state by disabling clicks and showing retro spinner", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithSound(
      <Button loading onClick={onClick}>
        Loading Action
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Loading Action" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("plays click sound on trigger", async () => {
    const user = userEvent.setup();
    renderWithSound(<Button sound="click">Sound Button</Button>);

    await user.click(screen.getByRole("button", { name: "Sound Button" }));
    expect(mockSoundValue.play).toHaveBeenCalledWith("click");
  });

  it("renders IconButton with accessible name and circular geometry", () => {
    renderWithSound(
      <IconButton aria-label="Favorite">
        <span data-testid="star">★</span>
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Favorite" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("rounded-full");
    expect(screen.getByTestId("star")).toBeInTheDocument();
  });
});

describe("UIK-05: Badge, Chip, and LevelIndicator primitives", () => {
  it("renders Badge variants: count, dot, isNew, status", () => {
    const { rerender } = render(<Badge count={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();

    rerender(<Badge count={150} max={99} />);
    expect(screen.getByText("99+")).toBeInTheDocument();

    rerender(<Badge dot aria-label="Unread notifications" />);
    expect(screen.getByRole("img", { name: "Unread notifications" })).toBeInTheDocument();

    rerender(<Badge isNew>New item</Badge>);
    expect(screen.getByText("New item")).toBeInTheDocument();

    rerender(<Badge status="success">Completed</Badge>);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders Chip and handles selection and keyboard removal", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onClick = vi.fn();

    render(
      <Chip selected={true} onClick={onClick} onRemove={onRemove} removeLabel="Remove Grammar tag">
        Grammar
      </Chip>,
    );

    const chipButton = screen.getByRole("button", { name: "Grammar" });
    expect(chipButton).toHaveAttribute("aria-pressed", "true");

    await user.click(chipButton);
    expect(onClick).toHaveBeenCalled();

    const removeButton = screen.getByRole("button", { name: "Remove Grammar tag" });
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);

    // Keyboard Backspace/Delete removal
    removeButton.focus();
    await user.keyboard("{Backspace}");
    expect(onRemove).toHaveBeenCalledTimes(2);

    await user.keyboard("{Delete}");
    expect(onRemove).toHaveBeenCalledTimes(3);
  });

  it("renders LevelIndicator with level number and star icon", () => {
    render(<LevelIndicator level={7} label="Level" />);
    expect(screen.getByText("Level 7")).toBeInTheDocument();
  });
});

describe("UIK-06: ShapeFrame, Sticker, and Squiggle arcade primitives", () => {
  it("builds shape path geometry for wavy, scalloped, ticket, stamp", () => {
    const wavy = buildShapePath("wavy", 200, 100, 8, 2);
    expect(wavy).toContain("M");
    expect(wavy).toContain("Q");

    const scalloped = buildShapePath("scalloped", 200, 100, 8, 2);
    expect(scalloped).toContain("A");

    const ticket = buildShapePath("ticket", 200, 100, 8, 2);
    expect(ticket).toContain("L");

    const stamp = buildShapePath("stamp", 200, 100, 8, 2);
    expect(stamp).toContain("Z");
  });

  it("renders ShapeFrame container with content", () => {
    render(<ShapeFrame shape="scalloped">Frame Content</ShapeFrame>);
    expect(screen.getByText("Frame Content")).toBeInTheDocument();
  });

  it("renders Sticker with tilt and white border", () => {
    render(
      <Sticker rotate={-3} tilt={4} shape="squircle">
        Sticker Content
      </Sticker>,
    );
    expect(screen.getByText("Sticker Content")).toBeInTheDocument();
  });

  it("renders Squiggle under key text phrase", () => {
    render(<Squiggle variant="wavy">Important Word</Squiggle>);
    expect(screen.getByText("Important Word")).toBeInTheDocument();
  });
});

describe("UIK-07: Card, Surface, and RetroContainer", () => {
  it("renders Surface with semantic tag and shadow depths", () => {
    render(
      <Surface as="article" shadow="lg" data-testid="surface">
        Article Content
      </Surface>,
    );
    const el = screen.getByTestId("surface");
    expect(el.tagName.toLowerCase()).toBe("article");
    expect(el).toHaveClass("shadow-retro-lg");
  });

  it("renders Card and RetroContainer with header band and hoverable lift", () => {
    render(
      <Card header={<span>Card Header</span>} headerTone="main" hoverable data-testid="retro-card">
        Card Body
      </Card>,
    );

    expect(screen.getByText("Card Header")).toBeInTheDocument();
    expect(screen.getByText("Card Body")).toBeInTheDocument();
    expect(screen.getByTestId("retro-card")).toHaveClass("hover:-translate-y-1");
  });
});

describe("UIK-08: Avatar and LevelRing primitives", () => {
  it("renders Avatar with fallback initials and name label", () => {
    render(<Avatar name="Fatima Zahra" size="md" status="online" />);
    expect(screen.getByText("FZ")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fatima Zahra, Online" })).toBeInTheDocument();
  });

  it("renders mascot SVGs for Pip and Nova", () => {
    const { rerender } = render(<Avatar mascot="pip" />);
    expect(screen.getByRole("img", { name: "Pip" })).toBeInTheDocument();

    rerender(<Avatar mascot="nova" />);
    expect(screen.getByRole("img", { name: "Nova" })).toBeInTheDocument();
  });

  it("renders LevelRing and calculates progress percentage", () => {
    render(
      <LevelRing value={75} size={44} label="Level Progress">
        <Avatar name="Ali" />
      </LevelRing>,
    );

    const ring = screen.getByRole("progressbar", { name: "Level Progress" });
    expect(ring).toHaveAttribute("aria-valuenow", "75");
    expect(ring).toHaveAttribute("aria-valuemin", "0");
    expect(ring).toHaveAttribute("aria-valuemax", "100");
  });
});
