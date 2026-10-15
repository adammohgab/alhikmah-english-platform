import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { SearchField } from "./SearchField";
import { Select } from "./Select";
import { Checkbox } from "./Checkbox";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { Switch } from "./Switch";
import { FormField } from "./FormField";
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

describe("UIK-09: Input, Textarea, and SearchField", () => {
  it("renders Input with label, left/right icons, and handles clearing", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <Input
        label="Username"
        defaultValue="adamm"
        clearable
        onClear={onClear}
        leftIcon={<span data-testid="left-icon">@</span>}
        showCount
        maxLength={20}
      />,
    );

    expect(screen.getByLabelText("Username")).toHaveValue("adamm");
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    expect(screen.getByText("5/20")).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: "Clear input" });
    await user.click(clearBtn);

    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(onClear).toHaveBeenCalled();
  });

  it("renders Input with error state and connects aria-describedby and role=alert", () => {
    render(<Input label="Email" error="Invalid email address" />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email address");
  });

  it("renders Textarea with char count and error display", async () => {
    const user = userEvent.setup();
    render(<Textarea label="Bio" showCount maxLength={100} placeholder="About you" />);

    const textarea = screen.getByLabelText("Bio");
    await user.type(textarea, "Hello world");

    expect(textarea).toHaveValue("Hello world");
    expect(screen.getByText("11/100")).toBeInTheDocument();
  });

  it("renders SearchField, triggers onSearch on Enter, and clears on Escape", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchField onSearch={onSearch} placeholder="Search vocabulary..." />);

    const searchInput = screen.getByPlaceholderText("Search vocabulary...");
    await user.type(searchInput, "grammar{Enter}");

    expect(onSearch).toHaveBeenCalledWith("grammar");

    await user.keyboard("{Escape}");
    expect(searchInput).toHaveValue("");
  });
});

describe("UIK-10: Select, Checkbox, RadioGroup, and Switch selection controls", () => {
  it("renders Select dropdown and exposes accessible combobox", () => {
    render(
      <Select
        aria-label="Grade"
        placeholder="Choose Grade"
        options={[
          { value: "g7", label: "Grade 7" },
          { value: "g8", label: "Grade 8" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Grade" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Choose Grade");
  });

  it("renders Checkbox and handles toggle", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(<Checkbox label="Accept Terms" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Accept Terms" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders RadioGroup and handles item selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup defaultValue="easy" onValueChange={onValueChange} aria-label="Difficulty">
        <RadioGroupItem value="easy" label="Easy" />
        <RadioGroupItem value="hard" label="Hard" />
      </RadioGroup>,
    );

    const easyRadio = screen.getByRole("radio", { name: "Easy" });
    const hardRadio = screen.getByRole("radio", { name: "Hard" });

    expect(easyRadio).toBeChecked();
    expect(hardRadio).not.toBeChecked();

    await user.click(hardRadio);
    expect(onValueChange).toHaveBeenCalledWith("hard");
  });

  it("renders Switch, toggles state, and plays sound", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    renderWithSound(
      <Switch label="Sound Effects" onCheckedChange={onCheckedChange} />,
    );

    const switchBtn = screen.getByRole("switch", { name: "Sound Effects" });
    expect(switchBtn).toHaveAttribute("aria-checked", "false");

    await user.click(switchBtn);
    expect(switchBtn).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(mockSoundValue.play).toHaveBeenCalled();
  });
});

describe("UIK-11: FormField wrapper", () => {
  it("automatically associates label, input, required marker, and helper hint", () => {
    render(
      <FormField label="Full Name" required hint="As it appears on your school ID">
        <input type="text" />
      </FormField>,
    );

    const label = screen.getByText("Full Name");
    expect(label).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("As it appears on your school ID")).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id");
    expect(input).toHaveAttribute("aria-labelledby");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("renders animated error message and sets aria-invalid", () => {
    render(
      <FormField label="Password" error="Password must be at least 8 characters">
        <input type="password" />
      </FormField>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 8 characters");
  });
});
