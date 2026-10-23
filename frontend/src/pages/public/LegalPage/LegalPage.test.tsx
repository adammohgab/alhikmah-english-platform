import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import LegalPage from "./index";
import { LEGAL_DOCUMENTS } from "./legal-content";

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function renderAt(entry: string) {
  return render(
    <SoundContext.Provider value={sound}>
      <MemoryRouter initialEntries={[entry]}>
        <LegalPage />
      </MemoryRouter>
    </SoundContext.Provider>,
  );
}

describe("PUB-10: LegalPage (SH-08)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens Terms on /terms with the last-updated date and a Print button", () => {
    renderAt("/terms");
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms and Privacy" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toHaveTextContent("15 October 2026");
    expect(screen.getByRole("tab", { name: "Terms of use", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Terms of use" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    expect(document.title).toBe("Terms and Privacy | Wordland");
  });

  it("opens Privacy on /privacy and from ?tab=privacy", () => {
    const { unmount } = renderAt("/privacy");
    expect(screen.getByRole("tab", { name: "Privacy notice", selected: true })).toBeInTheDocument();
    unmount();
    renderAt("/terms?tab=privacy");
    expect(screen.getByRole("tab", { name: "Privacy notice", selected: true })).toBeInTheDocument();
  });

  it("switches tabs with a click and with the arrow keys", async () => {
    const user = userEvent.setup();
    renderAt("/terms");
    await user.click(screen.getByRole("tab", { name: "Privacy notice" }));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy notice" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Terms of use" }),
    ).not.toBeInTheDocument();
    screen.getByRole("tab", { name: "Privacy notice" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Terms of use", selected: true })).toBeInTheDocument();
  });

  it("has every required section in each document", () => {
    const termsTitles = LEGAL_DOCUMENTS.terms.sections.map((s) => s.title.toLowerCase()).join("|");
    for (const part of [
      "who may use",
      "account",
      "acceptable use",
      "ai features",
      "rewards",
      "content ownership",
      "suspension",
      "changes",
      "contact",
    ]) {
      expect(termsTitles).toContain(part);
    }
    const privacyTitles = LEGAL_DOCUMENTS.privacy.sections
      .map((s) => s.title.toLowerCase())
      .join("|");
    for (const part of [
      "what data",
      "why",
      "who can see",
      "ai conversations",
      "how long",
      "rights",
      "protected",
      "contact",
    ]) {
      expect(privacyTitles).toContain(part);
    }
  });

  it("table of contents links point at real sections", () => {
    renderAt("/terms");
    const toc = screen.getByRole("navigation", { name: "Terms of use: sections" });
    const links = within(toc).getAllByRole("link");
    expect(links).toHaveLength(LEGAL_DOCUMENTS.terms.sections.length);
    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("the Sections toggle shows and hides the contents on small screens", async () => {
    const user = userEvent.setup();
    renderAt("/terms");
    const toggle = screen.getByRole("button", { name: "Sections" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(
      within(screen.getByRole("navigation", { name: "Terms of use: sections" })).getAllByRole(
        "link",
      )[0],
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("highlights the student data promises on the Privacy notice", () => {
    renderAt("/privacy");
    expect(screen.getByRole("heading", { name: "Our student data promises" })).toBeInTheDocument();
    expect(screen.getByText(/No advertising/)).toBeInTheDocument();
    expect(screen.getByText(/Data isolation/)).toBeInTheDocument();
  });

  it("caps the article line length and marks chrome for the print stylesheet", () => {
    renderAt("/terms");
    expect(document.querySelector("article")).toHaveClass("max-w-[65ch]");
    expect(document.querySelector("header")).toHaveClass("legal-print-hide");
    expect(document.querySelector("footer")).toHaveClass("legal-print-hide");
    expect(screen.getByRole("tablist")).toHaveClass("legal-print-hide");
  });

  it("Print opens the browser print dialog", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderAt("/terms");
    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
