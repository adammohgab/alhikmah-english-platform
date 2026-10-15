import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { usePlatformSettings } from "@/shared/hooks/usePlatformSettings";
import { MaintenanceMotif } from "./motifs";
import { SystemPageLayout } from "./SystemPageLayout";
import { describeTimeUntil } from "./time";
import { useDocumentTitle } from "./useDocumentTitle";

/* ========================================
   MaintenancePage: SH-13 "/maintenance" (SHARED-SPEC §5)

   Shows the message the Admin set in Platform settings and the expected return time, read
   live from `usePlatformSettings().settings.maintenance` (message, expected_back_at).
   "Check again" refetches the settings and, once maintenance is off, sends the person on
   to their dashboard (or sign-in). Admin accounts bypass this page (§6 rule 1) and go to
   the admin app, where they see a banner instead.
   ======================================== */

const MINUTE_MS = 60_000;

const DATE_TIME = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const CLOCK = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

function parseExpectedBack(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type CheckState =
  { kind: "idle" } | { kind: "checking" } | { kind: "still"; at: Date } | { kind: "failed" };

export default function MaintenancePage() {
  useDocumentTitle("Maintenance");

  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { settings, refetch } = usePlatformSettings();
  const [now, setNow] = useState(() => Date.now());
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });

  // Load the current message and return time once; the cached settings can be several
  // minutes old, and this page is exactly where people wait for fresh information.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Keep the "in about 2 hours" wording current.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (user?.role === "admin") {
    return <Navigate to={getRoleHomePath("admin")} replace />;
  }

  const { message, expected_back_at: expectedBackAt } = settings.maintenance;
  const expectedBack = parseExpectedBack(expectedBackAt);
  const relative = expectedBack ? describeTimeUntil(expectedBack, now) : null;

  const checkAgain = async () => {
    setCheck({ kind: "checking" });
    try {
      const result = await refetch();
      const stillOn = result.data?.maintenance.enabled ?? true;
      if (stillOn) {
        setCheck({ kind: "still", at: new Date() });
        return;
      }
      const target = isAuthenticated && user ? getRoleHomePath(user.role) : "/login";
      void navigate(target, { replace: true });
    } catch {
      setCheck({ kind: "failed" });
    }
  };

  let statusText = "";
  if (check.kind === "checking") statusText = "Checking…";
  else if (check.kind === "still") {
    statusText = `Still under maintenance. Last checked at ${CLOCK.format(check.at)}.`;
  } else if (check.kind === "failed") {
    statusText = "We could not check right now. Try again in a minute.";
  }

  return (
    <SystemPageLayout
      calm
      motif={<MaintenanceMotif />}
      title="We are doing maintenance."
      actions={
        <Button size="lg" onClick={() => void checkAgain()} loading={check.kind === "checking"}>
          Check again
        </Button>
      }
    >
      {message ? (
        <p className="mt-3 max-w-md whitespace-pre-line text-[16px] leading-snug text-muted">
          {message}
        </p>
      ) : null}

      {expectedBack && (
        <div className="mt-6 rounded-[16px] border-2 border-stroke bg-surface-0 px-6 py-4 shadow-retro-sm">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Expected back
          </p>
          <p className="mt-1 font-heading text-[20px] font-semibold text-stroke">
            <time dateTime={expectedBack.toISOString()}>{DATE_TIME.format(expectedBack)}</time>
          </p>
          <p className="mt-1 text-[14px] text-muted">
            {relative
              ? `That is ${relative}.`
              : "That time has passed. We should be back any moment now."}
          </p>
        </div>
      )}

      <p
        role="status"
        aria-live="polite"
        className="mt-4 min-h-[22px] max-w-md text-[14px] text-muted"
      >
        {statusText}
      </p>

      <p className="mt-2 max-w-md text-[14px] text-muted">
        Need to reach your school?{" "}
        <Link to="/help" className="font-semibold text-stroke underline underline-offset-2">
          See Help and contact
        </Link>
        .
      </p>
    </SystemPageLayout>
  );
}

export { MaintenancePage };
