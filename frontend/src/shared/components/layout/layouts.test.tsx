import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import { StudentAppShell } from "./StudentAppShell";
import { StudentTopBar } from "./StudentTopBar";
import { StudentBottomNav } from "./StudentBottomNav";
import { TeacherAppShell } from "./TeacherAppShell";
import { TeacherTopBar } from "./TeacherTopBar";
import { AdminAppShell } from "./AdminAppShell";
import { ViewAsBanner } from "./ViewAsBanner";
import { AuthContext, defaultAuthContext, type AuthProfile } from "@/app/providers/auth-context";
import { ToastProvider } from "@/app/providers/ToastProvider";
import { WorldProvider } from "@/shared/providers/WorldProvider";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";
import { EffectsProvider } from "@/shared/providers/EffectsProvider";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";

const mockSoundValue: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function renderInProviders(
  ui: React.ReactElement,
  authOverrides?: Partial<typeof defaultAuthContext>,
  initialEntries: string[] = ["/"],
) {
  const authValue = { ...defaultAuthContext, ...authOverrides };
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={authValue}>
        <WorldProvider>
          <ThemeProvider>
            <EffectsProvider>
              <ToastProvider>
                <SoundContext.Provider value={mockSoundValue}>{ui}</SoundContext.Provider>
              </ToastProvider>
            </EffectsProvider>
          </ThemeProvider>
        </WorldProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("UIK-22: Public Header & Footer", () => {
  it("PublicHeader renders logo, navigation links, skip link, and sign-in button when unauthenticated", async () => {
    const user = userEvent.setup();
    renderInProviders(<PublicHeader mainId="main-content" />);

    expect(screen.getByRole("link", { name: /Skip to content/i })).toHaveAttribute(
      "href",
      "#main-content",
    );

    const openMenuBtn = screen.getByRole("button", { name: "Open menu" });
    await user.click(openMenuBtn);

    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Curriculum" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("PublicHeader renders dashboard button when authenticated", () => {
    const mockUser: AuthProfile = {
      id: "u1",
      username: "student1",
      fullName: "Ali Mansoor",
      role: "student",
      adminLevel: null,
      status: "active",
      mustChangePassword: false,
    };

    renderInProviders(<PublicHeader />, { isAuthenticated: true, user: mockUser });

    expect(screen.getAllByText(/Open my dashboard/i).length).toBeGreaterThan(0);
  });

  it("PublicFooter renders school name, platform links, legal links, and accreditation", () => {
    renderInProviders(<PublicFooter accreditation="Licensed by Libyan Ministry of Education" />);

    expect(screen.getByText("Al Hikmah Private School")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Help and contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms and Privacy" })).toBeInTheDocument();
    expect(screen.getByText("Licensed by Libyan Ministry of Education")).toBeInTheDocument();
  });
});

describe("UIK-23: Student App Shell", () => {
  const dummyStats = {
    xpTotal: 450,
    level: 3,
    xpInLevel: 50,
    xpToNext: 150,
    coins: 120,
    streakDays: 5,
    rankTitle: "Explorer",
  };

  it("StudentTopBar renders live student stats (XP, streak, coins)", () => {
    renderInProviders(
      <StudentTopBar
        title="Student Dashboard"
        stats={dummyStats}
        unreadNotifications={2}
        onOpenNav={vi.fn()}
        navOpen={false}
        navId="student-drawer"
      />,
    );

    expect(screen.getAllByText(/Level 3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/120/).length).toBeGreaterThan(0);
  });

  it("StudentBottomNav renders the 5 core tabs", () => {
    renderInProviders(<StudentBottomNav />);

    expect(screen.getByRole("link", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Learn/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Play/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rewards/i })).toBeInTheDocument();
  });

  it("StudentAppShell wraps student layout with navigation items and renders page children", () => {
    renderInProviders(
      <StudentAppShell stats={dummyStats}>
        <div data-testid="student-child">Dashboard Home Content</div>
      </StudentAppShell>,
      {},
      ["/student"],
    );

    expect(screen.getByTestId("student-child")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Student" })).toBeInTheDocument();
  });
});

describe("UIK-24: Teacher App Shell", () => {
  const dummyClasses = [
    { id: "c1", name: "Grade 7-A English", grade: 7, studentCount: 24 },
    { id: "c2", name: "Grade 8-B English", grade: 8, studentCount: 22 },
  ];

  it("TeacherTopBar renders class switcher and pending submissions count", () => {
    renderInProviders(
      <TeacherTopBar
        title="Teacher Dashboard"
        classes={dummyClasses}
        selectedClassId="c1"
        onSelectClass={vi.fn()}
        pendingSubmissions={8}
        copilotOpen={false}
        onToggleCopilot={vi.fn()}
        copilotPanelId="copilot-panel"
        onOpenNav={vi.fn()}
        navOpen={false}
        navId="teacher-drawer"
        focused={false}
      />,
    );

    expect(screen.getAllByText("Grade 7-A English").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Ask AI/i })).toBeInTheDocument();
  });

  it("TeacherAppShell renders normal layout with navigation groups", () => {
    renderInProviders(
      <TeacherAppShell classes={dummyClasses} pendingSubmissions={3}>
        <div data-testid="teacher-content">Teacher Dashboard Overview</div>
      </TeacherAppShell>,
      {},
      ["/teacher"],
    );

    expect(screen.getByTestId("teacher-content")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Teacher" })).toBeInTheDocument();
  });

  it("TeacherAppShell enters focused mode and displays back link", () => {
    renderInProviders(
      <TeacherAppShell
        classes={dummyClasses}
        pendingSubmissions={0}
        focused={true}
        focusedBackTo={{ to: "/teacher/grading", label: "Grading queue" }}
      >
        <div data-testid="grading-view">Grading Submission #1</div>
      </TeacherAppShell>,
      {},
      ["/teacher/grading/sub-1"],
    );

    expect(screen.getByTestId("grading-view")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grading queue" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).not.toBeInTheDocument();
  });
});

describe("UIK-25: Admin App Shell & View-As Simulation", () => {
  it("ViewAsBanner displays simulated name, role, read-only warning, and calls onExit", async () => {
    const user = userEvent.setup();
    const handleExit = vi.fn();

    renderInProviders(
      <ViewAsBanner
        session={{ targetName: "Tariq Aziz", targetRole: "teacher" }}
        onExit={handleExit}
      />,
    );

    expect(screen.getByRole("region", { name: "View-as simulation" })).toBeInTheDocument();
    expect(screen.getByText(/Viewing as Tariq Aziz \(Teacher\)\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/This simulation is read-only: nothing you do here changes their data\./i),
    ).toBeInTheDocument();

    const exitBtn = screen.getByRole("button", { name: "Exit simulation" });
    await user.click(exitBtn);
    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it("AdminAppShell renders with breadcrumbs and opens drawer with user details", async () => {
    const user = userEvent.setup();
    const mockAdmin: AuthProfile = {
      id: "admin-1",
      username: "headmaster",
      fullName: "Dr. Khaled Omar",
      role: "admin",
      adminLevel: "super_admin",
      status: "active",
      mustChangePassword: false,
    };

    renderInProviders(
      <AdminAppShell>
        <div data-testid="admin-panel">Admin Users Table</div>
      </AdminAppShell>,
      { isAuthenticated: true, user: mockAdmin },
      ["/admin/users"],
    );

    expect(screen.getByTestId("admin-panel")).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("Users")).toBeInTheDocument();

    const menuBtn = screen.getByRole("button", { name: /Open navigation menu/i });
    await user.click(menuBtn);

    expect(screen.getByText("Dr. Khaled Omar")).toBeInTheDocument();
    expect(screen.getAllByText("Super admin").length).toBeGreaterThan(0);
  });
});
