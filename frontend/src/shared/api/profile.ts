import { supabase } from "@/shared/api/supabase";
import type { AuthProfile } from "@/app/providers/auth-context";
import type { AccountStatus, AdminLevel, DbUserRole, UserRole } from "@/shared/types/database.types";

/** The profile columns the app reads after sign-in. */
export const PROFILE_COLUMNS = "id, username, display_name, role, status, must_change_password";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  status: string;
  must_change_password: boolean | null;
}

const DB_ROLES: readonly DbUserRole[] = ["student", "teacher", "admin", "super_admin"];
const STATUSES: readonly AccountStatus[] = ["active", "locked", "archived", "disabled"];

export function isDbRole(value: unknown): value is DbUserRole {
  return typeof value === "string" && (DB_ROLES as readonly string[]).includes(value);
}

/** A database `super_admin` signs in to the admin portal with the super admin level. */
export function splitRole(role: DbUserRole): { role: UserRole; adminLevel: AdminLevel | null } {
  if (role === "super_admin") return { role: "admin", adminLevel: "super_admin" };
  if (role === "admin") return { role: "admin", adminLevel: "school_admin" };
  return { role, adminLevel: null };
}

/** Converts a profile row to the shape the app uses, or null when the row is not usable. */
export function toAuthProfile(row: ProfileRow): AuthProfile | null {
  if (!isDbRole(row.role)) return null;
  const status = STATUSES.find((value) => value === row.status);
  if (status === undefined) return null;
  const { role, adminLevel } = splitRole(row.role);
  return {
    id: row.id,
    username: row.username,
    fullName: row.display_name,
    role,
    adminLevel,
    status,
    mustChangePassword: row.must_change_password === true,
  };
}

/** Reads one profile. Returns null when it does not exist or cannot be read. */
export async function fetchAuthProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error || data === null) return null;
  return toAuthProfile(data);
}
