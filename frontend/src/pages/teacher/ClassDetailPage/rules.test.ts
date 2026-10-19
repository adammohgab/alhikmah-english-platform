import { describe, expect, it } from "vitest";
import { formatJoinCode, isClassTab, joinLink, percent } from "./rules";

describe("class detail rules", () => {
  it("builds the join link", () => {
    expect(joinLink("https://x.org", "/app/", "AB 12")).toBe("https://x.org/app/join?code=AB%2012");
  });
  it("groups the code and formats percentages", () => {
    expect(formatJoinCode("ABC123")).toBe("ABC 123");
    expect(percent(0.725)).toBe("73%");
    expect(percent(null)).toBe("—");
  });
  it("validates tab ids", () => {
    expect(isClassTab("roster")).toBe(true);
    expect(isClassTab("nope")).toBe(false);
  });
});
