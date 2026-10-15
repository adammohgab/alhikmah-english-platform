import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import type { AuthProfile } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import type { AdminLevel, UserRole } from "@/shared/types/database.types";
import { LockMotif } from "./motifs";
import { SystemPageLayout } from "./SystemPageLayout";
import { useDocumentTitle } from "./useDocumentTitle";

/* ========================================
   NoAccessPage: SH-14 "No access" (SHARED-SPEC §5, §6 rules 5 and 6)

   403 Forbidden for a signed-in person who opened another role's route (or a page that
   needs a higher admin level). It names the area without revealing details, explains how to
   switch accounts, and offers the way back to their own dashboard.

   The area comes from optional router state set by whoever redirects here:
     navigate("/no-access", { replace: true, state: { requiredRole: "teacher" } })
     navigate("/no-access", { replace: true, state: { requiredAdminLevel: "super_admin" } })
   Without state the page stays generic.

   Loop prevention: this page never redirects, never offers "Go back" (that would return to
   the forbidden route and straight back here), and its buttons replace history so the
   forbidden URL is not left behind. Signed-out visitors are sent to sign-in without a
   "redirect" value, so they cannot be bounced into the forbidden route after signing in.
   ======================================== */

const ROLES: readonly UserRole[] = ["student", "teacher", "admin"];

function readState(state: unknown): { role: UserRole | null; superAdminOnly: boolean } {
  if (typeof state !== "object" || state === null) return { role: null, superAdminOnly: false };
  const { requiredRole, requiredAdminLevel } = state as {
    requiredRole?: unknown;
    requiredAdminLevel?: unknown;
  };
  const role = ROLES.find((r) => r === requiredRole) ?? null;
  const level: AdminLevel = "super_admin";
  return { role, superAdminOnly: requiredAdminLevel === level };
}

function areaSentence(role: UserRole | null, superAdminOnly: boolean): string | null {
  if (superAdminOnly) return "Only a Super admin can open this page.";
  switch (role) {
    case "student":
      return "This page is for students.";
    case "teacher":
      return "This page is for teachers.";
    case "admin":
      return "This page is for school administrators.";
    default:
      return null;
  }
}

function describeAccount(user: AuthProfile): string {
  if (user.role === "student") return "a student";
  if (user.role === "teacher") return "a teacher";
  return user.adminLevel === "super_admin" ? "a Super admin" : "a School admin";
}

export default function NoAccessPage() {
  useDocumentTitle("No access");

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { role, superAdminOnly } = readState(location.state);
  const area = areaSentence(role, superAdminOnly);
  const signedIn = isAuthenticated && user !== null;

  const handleSwitchAccount = async () => {
    setSignOutFailed(false);
    setSigningOut(true);
    try {
      await signOut();
      void navigate("/login", { replace: true });
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <SystemPageLayout
        motif={<LockMotif />}
        eyebrow="403 Forbidden"
        title="Checking your account…"
      >
        <p role="status" className="mt-3 text-[16px] text-muted">
          One moment.
        </p>
      </SystemPageLayout>
    );
  }

  return (
    <SystemPageLayout
      motif={<LockMotif />}
      eyebrow="403 Forbidden"
      title="This page is not available for your account."
      actions={
        signedIn ? (
          <>
            <Button
              size="lg"
              onClick={() => void navigate(getRoleHomePath(user.role), { replace: true })}
            >
              Go to my dashboard
            </Button>
            <Button
              size="lg"
              variant="secondary"
              loading={signingOut}
              onClick={() => void handleSwitchAccount()}
            >
              Sign out and switch account
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={() => void navigate("/login", { replace: true })}>
            Go to sign in
          </Button>
        )
      }
    >
      {area && <p className="mt-3 max-w-md text-[16px] leading-snug text-muted">{area}</p>}

      {signedIn ? (
        <div className="mt-6 max-w-md rounded-[16px] border-2 border-stroke bg-surface-0 px-5 py-4 text-left shadow-retro-sm">
          <p className="font-heading text-[16px] font-semibold text-stroke">
            You are signed in as {describeAccount(user)}.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-snug text-muted">
            <li>Press &ldquo;Sign out and switch account&rdquo;.</li>
            <li>Sign in with the username and password for the area you need.</li>
          </ol>
          <p className="mt-3 text-[13px] text-muted">
            Think this is a mistake? Ask your school to check your account.{" "}
            <Link to="/help" className="font-semibold text-stroke underline underline-offset-2">
              Help and contact
            </Link>
          </p>
        </div>
      ) : (
        <p className="mt-3 max-w-md text-[16px] leading-snug text-muted">
          Sign in with an account that can open this page.
        </p>
      )}

      {signOutFailed && (
        <p role="alert" className="mt-4 max-w-md text-[14px] font-semibold text-danger-600">
          We could not sign you out. Check your connection and try again.
        </p>
      )}
    </SystemPageLayout>
  );
}

export { NoAccessPage };
