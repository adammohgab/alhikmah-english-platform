import { describe, expect, it } from "vitest";
import { splitRole, toAuthProfile } from "./profile";

const row = {
  id: "u1",
  username: "sam.one",
  display_name: "Sam One",
  role: "student",
  status: "active",
  must_change_password: false,
};

describe("profile mapping", () => {
  it("maps a student row", () => {
    expect(toAuthProfile(row)).toEqual({
      id: "u1",
      username: "sam.one",
      fullName: "Sam One",
      role: "student",
      adminLevel: null,
      status: "active",
      mustChangePassword: false,
    });
  });

  it("maps super_admin to the admin portal with the super level", () => {
    expect(splitRole("super_admin")).toEqual({ role: "admin", adminLevel: "super_admin" });
    expect(splitRole("admin")).toEqual({ role: "admin", adminLevel: "school_admin" });
  });

  it("keeps the locked status and the password flag", () => {
    const mapped = toAuthProfile({ ...row, status: "locked", must_change_password: true });
    expect(mapped).toMatchObject({ status: "locked", mustChangePassword: true });
  });

  it("rejects unknown roles and statuses", () => {
    expect(toAuthProfile({ ...row, role: "owner" })).toBeNull();
    expect(toAuthProfile({ ...row, status: "paused" })).toBeNull();
  });
});
