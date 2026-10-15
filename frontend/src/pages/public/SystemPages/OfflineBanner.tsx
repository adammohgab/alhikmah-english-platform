import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "./useOnlineStatus";

/* In-app offline banner (SHARED-SPEC SH-12): a slim bar at the top of the app that appears
   and disappears with the connection state. Render it once, at the top of an app shell. */

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b-2 border-stroke bg-world-amber-200 px-4 py-1.5 text-center text-[13px] font-semibold text-stroke"
    >
      <WifiOff aria-hidden="true" size={16} strokeWidth={2.5} />
      Offline. Changes will sync when you reconnect.
    </div>
  );
}
