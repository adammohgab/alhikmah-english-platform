import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import LandingPage from "./index";

interface LenisSpy {
  options: unknown;
  raf: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const lenisState = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock("lenis", () => ({
  default: class MockLenis {
    options: unknown;
    raf = vi.fn();
    scrollTo = vi.fn();
    stop = vi.fn();
    start = vi.fn();
    destroy = vi.fn();
    constructor(options: unknown) {
      this.options = options;
      lenisState.instances.push(this);
    }
  },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function lenisInstances(): LenisSpy[] {
  return lenisState.instances as LenisSpy[];
}

function renderPage(entry = "/") {
  return render(
    <SoundContext.Provider value={sound}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<p>Login screen</p>} />
          <Route path="/help" element={<p>Help screen</p>} />
        </Routes>
      </MemoryRouter>
    </SoundContext.Provider>,
  );
}

const meta = (attribute: "name" | "property", key: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

describe("PUB-03: LandingPage assembly (SH-01)", () => {
  const originalTitle = document.title;
  const originalMatchMedia = window.matchMedia.bind(window);
  let seededDescription: HTMLMetaElement;

  beforeEach(() => {
    lenisState.instances.length = 0;
    document.title = "Original title";
    seededDescription = document.createElement("meta");
    seededDescription.setAttribute("name", "description");
    seededDescription.setAttribute("content", "Original description");
    document.head.appendChild(seededDescription);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    seededDescription.remove();
    document.title = originalTitle;
    document.body.style.overflow = "";
  });

  it("attaches the header, the sections and the footer around one main landmark", () => {
    renderPage();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /Practice English/ })).toBeInTheDocument();
    for (const name of [
      "Six ways the platform keeps you going",
      "A clear path from grade 7 to grade 12",
      "Ready to continue?",
    ]) {
      expect(within(main).getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("gives the header anchor links a target on the page", () => {
    const { container } = renderPage();
    expect(container.querySelector("#features")).not.toBeNull();
    expect(container.querySelector("#curriculum")).not.toBeNull();
  });

  it("sends the hero button and the banner button to /login", async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await user.click(screen.getByRole("button", { name: "Sign In to Learn" }));
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    first.unmount();

    renderPage();
    const banner = screen.getByRole("region", { name: "Ready to continue?" });
    await user.click(within(banner).getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("links the banner help line to /help", async () => {
    const user = userEvent.setup();
    renderPage();
    const banner = screen.getByRole("region", { name: "Ready to continue?" });
    const help = within(banner).getByRole("link", { name: "Need help signing in?" });
    expect(help).toHaveAttribute("href", "/help");
    await user.click(help);
    expect(await screen.findByText("Help screen")).toBeInTheDocument();
  });

  it("does not render testimonials, because the repo holds no real quotes", () => {
    renderPage();
    expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
  });

  it("sets the title and the SEO and OpenGraph tags, and restores them on unmount", () => {
    const { unmount } = renderPage();

    expect(document.title).toBe("Practice English every day | Al Hikmah English Platform");
    expect(meta("name", "description")?.getAttribute("content")).toMatch(/AI tutor/);
    expect(meta("property", "og:title")?.getAttribute("content")).toBe(document.title);
    expect(meta("property", "og:type")?.getAttribute("content")).toBe("website");
    expect(meta("property", "og:description")?.getAttribute("content")).toBe(
      meta("name", "description")?.getAttribute("content"),
    );
    expect(meta("property", "og:image")?.getAttribute("content")).toMatch(/^https?:\/\//);
    expect(meta("property", "og:image:alt")?.getAttribute("content")).toBeTruthy();
    expect(meta("name", "twitter:card")?.getAttribute("content")).toBe("summary");
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);

    unmount();

    expect(document.title).toBe("Original title");
    expect(meta("name", "description")?.getAttribute("content")).toBe("Original description");
    expect(meta("property", "og:title")).toBeNull();
    expect(meta("name", "twitter:card")).toBeNull();
  });

  it("runs one Lenis instance from the GSAP ticker and destroys it on unmount", () => {
    const { unmount } = renderPage();

    expect(lenisInstances()).toHaveLength(1);
    expect(lenisInstances()[0]?.options).toMatchObject({
      autoRaf: false,
      syncTouch: false,
      wheelMultiplier: 1,
    });

    unmount();
    expect(lenisInstances()[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses native scrolling under reduced motion", () => {
    window.matchMedia = (query: string) => ({
      ...originalMatchMedia(query),
      matches: query.includes("prefers-reduced-motion"),
    });

    renderPage();
    expect(lenisInstances()).toHaveLength(0);
  });

  it("pauses Lenis while the mobile menu locks the page", async () => {
    renderPage();
    const lenis = lenisInstances()[0];
    expect(lenis).toBeDefined();

    document.body.style.overflow = "hidden";
    await waitFor(() => {
      expect(lenis?.stop).toHaveBeenCalled();
    });

    lenis?.start.mockClear();
    document.body.style.overflow = "";
    await waitFor(() => {
      expect(lenis?.start).toHaveBeenCalled();
    });
  });

  it("scrolls to an anchor from another page below the sticky header", () => {
    const { container } = renderPage("/#curriculum");
    const target = container.querySelector("#curriculum");

    expect(target).not.toBeNull();
    expect(lenisInstances()[0]?.scrollTo).toHaveBeenCalledWith(target, { offset: -64 });
  });
});
