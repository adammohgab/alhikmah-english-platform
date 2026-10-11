import type { UserRole } from "@/shared/types/database.types";

/**
 * Maps a user's role to their designated default portal path.
 */
export function getRoleHomePath(role: UserRole): string {
  switch (role) {
    case "student":
      return "/student";
    case "teacher":
      return "/teacher";
    case "admin":
      return "/admin";
    default:
      return "/login";
  }
}
