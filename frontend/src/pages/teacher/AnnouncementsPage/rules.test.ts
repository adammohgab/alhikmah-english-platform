import { describe, expect, it } from "vitest";
import {
  BODY_MAX,
  EMPTY_COMPOSER,
  TITLE_MAX,
  expiryToIso,
  isPriority,
  plainText,
  readRate,
  sanitizeAnnouncementHtml,
  validateComposer,
} from "./rules";
import type { ComposerValues } from "./rules";

const NOW = Date.parse("2026-10-21T15:00:00Z");

function values(overrides: Partial<ComposerValues> = {}): ComposerValues {
  return {
    ...EMPTY_COMPOSER,
    title: "Quiz on Tuesday",
    classId: "class-1",
    bodyHtml: "<p>Unit 3 quiz on Tuesday. Bring pencils.</p>",
    ...overrides,
  };
}

describe("validateComposer", () => {
  it("accepts a complete announcement", () => {
    expect(validateComposer(values(), NOW)).toEqual({});
  });

  it("requires a title, a class and a message", () => {
    const errors = validateComposer(
      values({ title: "   ", classId: "", bodyHtml: "<p></p>" }),
      NOW,
    );
    expect(errors.title).toBeDefined();
    expect(errors.classId).toBeDefined();
    expect(errors.bodyHtml).toBeDefined();
  });

  it("rejects titles over the database limit", () => {
    const errors = validateComposer(values({ title: "x".repeat(TITLE_MAX + 1) }), NOW);
    expect(errors.title).toMatch(/under 200/);
  });

  it("rejects bodies over the database limit, counting markup", () => {
    const errors = validateComposer(
      values({ bodyHtml: `<p>${"a".repeat(BODY_MAX)}</p>` }),
      NOW,
    );
    expect(errors.bodyHtml).toMatch(/Shorten/);
  });

  it("requires an expiry in the future when one is set", () => {
    const past = validateComposer(values({ expiresAt: "2026-10-01T10:00" }), NOW);
    expect(past.expiresAt).toMatch(/future/);
    const future = validateComposer(values({ expiresAt: "2099-01-01T10:00" }), NOW);
    expect(future.expiresAt).toBeUndefined();
  });
});

describe("expiryToIso", () => {
  it("returns null for an empty value and an ISO string otherwise", () => {
    expect(expiryToIso("")).toBeNull();
    expect(expiryToIso("2099-01-01T10:00")).toMatch(/^2099-01-01T/);
  });
});

describe("readRate", () => {
  it("rounds to a whole percentage and handles empty classes", () => {
    expect(readRate(18, 24)).toBe(75);
    expect(readRate(1, 3)).toBe(33);
    expect(readRate(0, 0)).toBe(0);
  });
});

describe("isPriority", () => {
  it("accepts only the three priorities", () => {
    expect(isPriority("urgent")).toBe(true);
    expect(isPriority("important")).toBe(true);
    expect(isPriority("normal")).toBe(true);
    expect(isPriority("all")).toBe(false);
  });
});

describe("plainText", () => {
  it("strips markup and trims", () => {
    expect(plainText("<p> <strong>Bring</strong> pencils </p>")).toBe("Bring pencils");
  });
});

describe("sanitizeAnnouncementHtml", () => {
  it("keeps basic formatting and lists", () => {
    const html = "<p><strong>Homework</strong></p><ul><li><em>Read</em> unit 3</li></ul>";
    expect(sanitizeAnnouncementHtml(html)).toBe(html);
  });

  it("removes scripts and event handlers", () => {
    const clean = sanitizeAnnouncementHtml(
      '<p onclick="steal()">Hi</p><script>alert(1)</script><img src=x onerror="alert(2)">',
    );
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick|onerror|<img/i);
    expect(clean).toContain("Hi");
  });

  it("keeps only safe link schemes and hardens them", () => {
    const safe = sanitizeAnnouncementHtml(
      '<p><a href="https://example.org/x" class="y">link</a></p>',
    );
    expect(safe).toContain('href="https://example.org/x"');
    expect(safe).toContain('rel="noopener noreferrer nofollow"');
    expect(safe).not.toContain('class="y"');

    const unsafe = sanitizeAnnouncementHtml('<p><a href="javascript:alert(1)">bad</a></p>');
    expect(unsafe).not.toMatch(/<a/);
    expect(unsafe).toContain("bad");
  });

  it("unwraps unknown elements but keeps their text", () => {
    expect(sanitizeAnnouncementHtml("<h1>Title</h1>")).toBe("Title");
  });
});
