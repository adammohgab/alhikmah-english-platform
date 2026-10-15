import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { OfflineMotif } from "./motifs";
import { safeReturnPath, withBase } from "./paths";
import { SystemPageLayout } from "./SystemPageLayout";
import { useDocumentTitle } from "./useDocumentTitle";
import { useOnlineStatus } from "./useOnlineStatus";

/* ========================================
   OfflinePage: SH-12 "/offline" (SHARED-SPEC §5)

   Shows "You are offline." and waits for the connection. The moment `navigator.onLine`
   becomes true (the browser's `online` event, or already true when the page opens) it does
   a full page load of where the person was headed, which is the "automatic reload".

   Where to: a `?next=/path` value or `location.state.from`, if it is a safe in-app path that
   is not /offline itself; otherwise the person's dashboard, or the home page when signed
   out. The target can never be /offline, so reconnecting cannot bounce back here.
   ======================================== */

/** Short pause so the person sees "Back online" before the page changes. */
const RECONNECT_DELAY_MS = 700;

function readFromState(state: unknown): unknown {
  if (typeof state === "object" && state !== null && "from" in state) {
    return state.from;
  }
  return undefined;
}

export default function OfflinePage() {
  useDocumentTitle("Offline");

  const online = useOnlineStatus();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [stillOffline, setStillOffline] = useState(false);
  const leavingRef = useRef(false);

  const destination = (() => {
    const fromQuery = safeReturnPath(new URLSearchParams(location.search).get("next"));
    if (fromQuery) return fromQuery;
    const fromState = safeReturnPath(readFromState(location.state));
    if (fromState) return fromState;
    return isAuthenticated && user ? getRoleHomePath(user.role) : "/";
  })();

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    window.location.assign(withBase(destination));
  }, [destination]);

  useEffect(() => {
    if (!online) return;
    const timer = window.setTimeout(leave, RECONNECT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [online, leave]);

  const handleTryAgain = () => {
    if (navigator.onLine) {
      leave();
      return;
    }
    setStillOffline(true);
  };

  let status = "Waiting for your connection. This page will reload by itself when you are back.";
  if (online) status = "You are back online. Reloading…";
  else if (stillOffline) status = "Still offline. Check your Wi-Fi or mobile data, then try again.";

  return (
    <SystemPageLayout
      motif={<OfflineMotif />}
      title="You are offline."
      actions={
        <Button size="lg" onClick={handleTryAgain} loading={online}>
          Try again
        </Button>
      }
    >
      <p className="mt-3 max-w-md text-[16px] leading-snug text-muted">
        Check your connection. Work in progress is saved on this device and will sync when you are
        back.
      </p>
      <p role="status" aria-live="polite" className="mt-4 max-w-md text-[14px] text-muted">
        {status}
      </p>
    </SystemPageLayout>
  );
}

export { OfflinePage };
