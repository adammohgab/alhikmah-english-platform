import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";
import { XpBar } from "./XpBar";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";
import { FilterBar } from "./FilterBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { SegmentedControl } from "./SegmentedControl";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import type { ColumnDef } from "@tanstack/react-table";

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

describe("UIK-16: Progress & Gauges", () => {
  it("ProgressBar renders progressbar role, clamps values, and applies accessible labels", () => {
    const { rerender } = renderWithSound(
      <ProgressBar value={40} max={100} label="Course Progress" />,
    );
    const bar = screen.getByRole("progressbar", { name: "Course Progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    rerender(
      <SoundContext.Provider value={mockSoundValue}>
        <ProgressBar value={150} max={100} label="Course Progress" />
      </SoundContext.Provider>,
    );
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("ProgressRing renders progressbar role with centered children", () => {
    renderWithSound(
      <ProgressRing value={75} max={100} label="Level Ring">
        <span data-testid="ring-center">Lvl 5</span>
      </ProgressRing>,
    );
    const ring = screen.getByRole("progressbar", { name: "Level Ring" });
    expect(ring).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByTestId("ring-center")).toHaveTextContent("Lvl 5");
  });

  it("XpBar renders XP value and max label", () => {
    renderWithSound(<XpBar value={350} max={1000} label="XP meter" />);
    const bar = screen.getByRole("progressbar", { name: "XP meter" });
    expect(bar).toHaveAttribute("aria-valuenow", "350");
    expect(screen.getByText(/350 \/ 1,000 XP/i)).toBeInTheDocument();
  });
});

describe("UIK-17: Loading, Empty, and Error States", () => {
  it("Skeleton renders role=status and label by default", () => {
    renderWithSound(<Skeleton shape="text" />);
    const status = screen.getByRole("status", { name: "Loading…" });
    expect(status).toHaveAttribute("aria-label", "Loading…");
  });

  it("EmptyState renders illustration, title, description, and triggers onAction", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    renderWithSound(
      <EmptyState
        title="No Assignments Found"
        description="You have cleared all pending homework."
        actionLabel="Create Assignment"
        onAction={handleAction}
      />,
    );

    expect(screen.getByText("No Assignments Found")).toBeInTheDocument();
    expect(screen.getByText("You have cleared all pending homework.")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Create Assignment" });
    await user.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("EmptyState supports Arabic locale with RTL", () => {
    renderWithSound(<EmptyState locale="ar" />);
    const container = screen.getByText("لا يوجد شيء هنا بعد").closest("[dir='rtl']");
    expect(container).toBeInTheDocument();
  });

  it("ErrorState renders title, description, and triggers onRetry", async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();
    renderWithSound(
      <ErrorState
        title="Connection Failed"
        description="Could not reach the server."
        retryLabel="Try Again"
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(screen.getByText("Could not reach the server.")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Try Again" });
    await user.click(btn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});

describe("UIK-18: DataTable", () => {
  interface Student {
    id: string;
    name: string;
    grade: string;
  }

  const columns: ColumnDef<Student>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "grade", header: "Grade" },
  ];

  const data: Student[] = [
    { id: "1", name: "Ahmed", grade: "Grade 7" },
    { id: "2", name: "Fatima", grade: "Grade 8" },
    { id: "3", name: "Omar", grade: "Grade 9" },
  ];

  it("renders table rows and columns correctly", () => {
    renderWithSound(
      <DataTable label="Students Table" columns={columns} data={data} getRowId={(s) => s.id} />,
    );

    expect(screen.getByRole("grid", { name: "Students Table" })).toBeInTheDocument();
    expect(screen.getByText("Ahmed")).toBeInTheDocument();
    expect(screen.getByText("Fatima")).toBeInTheDocument();
    expect(screen.getByText("Omar")).toBeInTheDocument();
  });

  it("allows selecting rows and shows bulk action bar", async () => {
    const user = userEvent.setup();
    const handleBulkDelete = vi.fn();

    renderWithSound(
      <DataTable
        label="Students Table"
        columns={columns}
        data={data}
        selectable={true}
        getRowId={(s) => s.id}
        bulkActions={[
          {
            id: "delete",
            label: "Delete Selected",
            variant: "danger",
            onAction: (rows, clear) => {
              handleBulkDelete(rows);
              clear();
            },
          },
        ]}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    // Click first item checkbox (index 1, as index 0 is select all)
    await user.click(checkboxes[1]!);

    const bulkButton = await screen.findByRole("button", { name: /Delete Selected/i });
    expect(bulkButton).toBeInTheDocument();
    await user.click(bulkButton);
    expect(handleBulkDelete).toHaveBeenCalledTimes(1);
  });
});

describe("UIK-19: Pagination & FilterBar", () => {
  it("Pagination renders current page, item count, and invokes onPageChange", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    renderWithSound(
      <Pagination page={1} pageSize={10} totalItems={30} onPageChange={handlePageChange} />,
    );

    expect(screen.getByText(/Showing 1 to 10 of 30/i)).toBeInTheDocument();
    const page2Btn = screen.getByRole("button", { name: "Page 2" });
    await user.click(page2Btn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("FilterBar renders search field and filter chips and clear all button", async () => {
    const user = userEvent.setup();
    const handleSearchChange = vi.fn();
    const handleFilterChange = vi.fn();
    const handleClearAll = vi.fn();

    const filterGroups = [
      {
        id: "grade",
        label: "Grade",
        options: [
          { value: "g7", label: "Grade 7" },
          { value: "g8", label: "Grade 8" },
        ],
      },
    ];

    renderWithSound(
      <FilterBar
        search="Vocabulary"
        onSearchChange={handleSearchChange}
        filters={filterGroups}
        filterValues={{ grade: ["g7"] }}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />,
    );

    expect(screen.getByDisplayValue("Vocabulary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear all/i })).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /Clear all/i });
    await user.click(clearBtn);
    expect(handleClearAll).toHaveBeenCalledTimes(1);
  });
});

describe("UIK-20: Tabs & SegmentedControl", () => {
  it("Tabs switches active tab panel on click", async () => {
    const user = userEvent.setup();
    renderWithSound(
      <Tabs defaultValue="tab1">
        <TabsList aria-label="Sections">
          <TabsTrigger value="tab1">First</TabsTrigger>
          <TabsTrigger value="tab2">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Panel One Content</TabsContent>
        <TabsContent value="tab2">Panel Two Content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("Panel One Content")).toBeInTheDocument();
    expect(screen.queryByText("Panel Two Content")).not.toBeInTheDocument();

    const tab2 = screen.getByRole("tab", { name: "Second" });
    await user.click(tab2);

    expect(screen.getByText("Panel Two Content")).toBeInTheDocument();
    expect(screen.queryByText("Panel One Content")).not.toBeInTheDocument();
  });

  it("SegmentedControl renders options and fires onValueChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithSound(
      <SegmentedControl
        aria-label="View Mode"
        value="grid"
        onValueChange={handleChange}
        options={[
          { value: "grid", label: "Grid View" },
          { value: "list", label: "List View" },
        ]}
      />,
    );

    const listBtn = screen.getByRole("tab", { name: "List View" });
    await user.click(listBtn);
    expect(handleChange).toHaveBeenCalledWith("list");
  });
});

describe("UIK-21: Accordion", () => {
  it("Accordion toggles content visibility on trigger click", async () => {
    const user = userEvent.setup();
    renderWithSound(
      <Accordion type="single" collapsible defaultValue="q1">
        <AccordionItem value="q1">
          <AccordionTrigger>What is Al Hikmah?</AccordionTrigger>
          <AccordionContent>An English learning platform for Libyan students.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="q2">
          <AccordionTrigger>How to earn XP?</AccordionTrigger>
          <AccordionContent>Complete lessons and quizzes daily.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(
      screen.getByText("An English learning platform for Libyan students."),
    ).toBeInTheDocument();
    expect(screen.getByText("What is Al Hikmah?")).toBeInTheDocument();
    expect(screen.getByText("How to earn XP?")).toBeInTheDocument();

    const q2Trigger = screen.getByRole("button", { name: "How to earn XP?" });
    await user.click(q2Trigger);

    await waitFor(() => {
      expect(screen.getByText("Complete lessons and quizzes daily.")).toBeVisible();
    });
  });
});
