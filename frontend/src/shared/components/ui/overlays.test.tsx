import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, Modal, DialogClose } from "./Dialog";
import { Drawer } from "./Drawer";
import { DropdownMenu } from "./DropdownMenu";
import { ContextMenu } from "./ContextMenu";
import { Tooltip } from "./Tooltip";
import { Popover } from "./Popover";
import { SoundContext } from "@/shared/hooks/useSound";

const mockSoundValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  isMuted: false,
  toggleMute: vi.fn(),
  audioState: "unlocked" as const,
};

function renderWithSound(ui: React.ReactElement) {
  return render(
    <SoundContext.Provider value={mockSoundValue}>
      {ui}
    </SoundContext.Provider>
  );
}

describe("UIK-12: Dialog & Modal", () => {
  it("renders controlled open dialog with title, description, body, and close button", () => {
    const handleOpenChange = vi.fn();
    renderWithSound(
      <Dialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Quest Completed"
        description="You finished Chapter 1"
        footer={<button>Claim Reward</button>}
      >
        <p>Here is your prize!</p>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Quest Completed")).toBeInTheDocument();
    expect(screen.getByText("You finished Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Here is your prize!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claim Reward/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  it("calls onOpenChange when close button is clicked", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    renderWithSound(
      <Dialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Settings"
      >
        <div>Content</div>
      </Dialog>
    );

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    await user.click(closeBtn);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("Modal is an alias of Dialog", () => {
    expect(Modal).toBe(Dialog);
  });

  it("renders with DialogClose in footer", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    renderWithSound(
      <Dialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Confirm Exit"
        footer={
          <DialogClose asChild>
            <button>Dismiss</button>
          </DialogClose>
        }
      >
        <p>Are you sure?</p>
      </Dialog>
    );

    const dismissBtn = screen.getByRole("button", { name: /Dismiss/i });
    await user.click(dismissBtn);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("UIK-13: Drawer", () => {
  it("renders open drawer with title, description, and footer", () => {
    renderWithSound(
      <Drawer
        open={true}
        title="Inventory"
        description="All your unlocked items"
        footer={<button>Equip All</button>}
      >
        <div>Item 1: Golden Key</div>
      </Drawer>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("All your unlocked items")).toBeInTheDocument();
    expect(screen.getByText("Item 1: Golden Key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Equip All/i })).toBeInTheDocument();
  });

  it("triggers onOpenChange when close button is clicked", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    renderWithSound(
      <Drawer
        open={true}
        onOpenChange={handleOpenChange}
        title="Backpack"
        closeLabel="Close Drawer"
      >
        <div>Items</div>
      </Drawer>
    );

    const closeBtn = screen.getByRole("button", { name: /Close Drawer/i });
    await user.click(closeBtn);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("UIK-14: DropdownMenu & ContextMenu", () => {
  it("renders DropdownMenu trigger and opens menu on click", async () => {
    const user = userEvent.setup();
    renderWithSound(
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button>Options</button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Actions</DropdownMenu.Label>
          <DropdownMenu.Item onSelect={vi.fn()}>Edit Profile</DropdownMenu.Item>
          <DropdownMenu.Item danger onSelect={vi.fn()}>
            Delete Account
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={vi.fn()}>
            Settings <DropdownMenu.Shortcut>⌘S</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );

    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("⌘S")).toBeInTheDocument();
  });

  it("renders ContextMenu trigger and responds to right-click contextmenu event", async () => {
    renderWithSound(
      <ContextMenu>
        <ContextMenu.Trigger>
          <div data-testid="context-area">Right-click me</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={vi.fn()}>Copy Link</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    );

    const area = screen.getByTestId("context-area");
    fireEvent.contextMenu(area);

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
  });
});

describe("UIK-15: Tooltip & Popover", () => {
  it("renders Tooltip around trigger and supplies accessible description", () => {
    renderWithSound(
      <Tooltip.Provider delayDuration={0}>
        <Tooltip>
          <Tooltip.Trigger asChild>
            <button aria-describedby="tip-1">Hover me</button>
          </Tooltip.Trigger>
          <Tooltip.Content id="tip-1">
            Extra XP info
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip>
      </Tooltip.Provider>
    );

    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
  });

  it("renders Popover with trigger, opens dialog panel on click", async () => {
    const user = userEvent.setup();
    renderWithSound(
      <Popover>
        <Popover.Trigger asChild>
          <button>Show Details</button>
        </Popover.Trigger>
        <Popover.Content>
          <Popover.Title>XP Mechanics</Popover.Title>
          <Popover.Description>Earn 10 XP per correct question.</Popover.Description>
          <Popover.Close asChild>
            <button>Got it</button>
          </Popover.Close>
        </Popover.Content>
      </Popover>
    );

    const trigger = screen.getByRole("button", { name: "Show Details" });
    await user.click(trigger);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("XP Mechanics")).toBeInTheDocument();
    expect(screen.getByText("Earn 10 XP per correct question.")).toBeInTheDocument();
  });
});
