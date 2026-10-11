import { Navigate, useLocation, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/app/providers/auth-context";
import { usePlatformSettings } from "@/shared/hooks/usePlatformSettings";
import type { UserRole, AdminLevel } from "@/shared/types/database.types";
import { getRoleHomePath } from "./guard-utils";

export interface ProtectedRouteProps {
  allowedRoles?: UserRole[] | undefined;
  requiredAdminLevel?: AdminLevel | undefined;
  children?: ReactNode | undefined;
}

/**
 * Route guard checking maintenance mode, authentication, account status,
 * mandatory password updates, and role/permission authorization.
 */
export function ProtectedRoute({
  allowedRoles,
  requiredAdminLevel,
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { settings } = usePlatformSettings();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-text-muted text-sm font-medium">Loading session...</div>
      </div>
    );
  }

  // 1. Unauthenticated users are redirected to login with redirect param
  if (!isAuthenticated || !user) {
    const currentPath = `${location.pathname}${location.search}`;
    const redirectParam = encodeURIComponent(currentPath);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  // 2. Maintenance mode check: admins bypass maintenance; students and teachers are redirected
  if (settings.maintenance.enabled && user.role !== "admin") {
    return <Navigate to="/maintenance" replace />;
  }

  // 3. Account status checks (archived / disabled accounts go to account-not-active)
  if (user.status === "archived" || user.status === "disabled") {
    return <Navigate to="/account-not-active" replace />;
  }

  // 4. Forced password change check
  if (user.mustChangePassword && location.pathname !== "/set-new-password") {
    return <Navigate to="/set-new-password" replace />;
  }

  // 5. Role authorization check
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/no-access" replace />;
  }

  // 6. Admin sub-level permission check (e.g. Super Admin required)
  if (
    requiredAdminLevel &&
    user.role === "admin" &&
    user.adminLevel !== requiredAdminLevel &&
    user.adminLevel !== "super_admin"
  ) {
    return <Navigate to="/no-access" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/**
 * Guard for public/auth pages (e.g. /login) that redirects already authenticated users
 * to their designated role portal or preserved redirect target.
 */
export function PublicOnlyRoute({ children }: { children?: ReactNode | undefined }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isAuthenticated && user) {
    const searchParams = new URLSearchParams(location.search);
    const redirectTarget = searchParams.get("redirect");

    if (redirectTarget?.startsWith("/")) {
      // Ensure the redirect target belongs to the user's role area
      const expectedRolePrefix = `/${user.role}`;
      if (redirectTarget.startsWith(expectedRolePrefix)) {
        return <Navigate to={redirectTarget} replace />;
      }
    }

    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
