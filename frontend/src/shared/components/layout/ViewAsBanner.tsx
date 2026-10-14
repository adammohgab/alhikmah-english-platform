import { Eye } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   ViewAsBanner (ADMIN-SPEC §4 shell, §11.3 "omnipresent colored banner with an exit action")

   A warning bar that docks to the top of the screen for as long as an admin is simulating
   a student or a teacher. It never closes by itself and has no dismiss control: the only
   way out is "Exit simulation", which runs `onExit` on the first click with no confirmation.
   The simulation is read-only (backend 04-AUTH-AND-ACCESS §5), and the bar says so.
   Color is spec §3.3 warning with ink text; the Eye glyph and the words carry the meaning too.
   ======================================== */

export type ViewAsTargetRole = "student" | "teacher";

export interface ViewAsSession {
  /** Full name of the person being simulated. */
  targetName: string;
  targetRole: ViewAsTargetRole;
}

export interface ViewAsBannerProps {
  session: ViewAsSession;
  /** Ends the simulation and restores the admin session. Called synchronously on click. */
  onExit: () => void;
  /** Shows the loading state on the button while the caller finishes restoring the session. */
  exiting?: boolean | undefined;
  className?: string | undefined;
}

const ROLE_LABEL: Record<ViewAsTargetRole, string> = {
  student: "Student",
  teacher: "Teacher",
};

export function ViewAsBanner({ session, onExit, exiting = false, className }: ViewAsBannerProps) {
  return (
    <div
      role="region"
      aria-label="View-as simulation"
      className={cn(
        "sticky top-0 z-[60] flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b-[3px] border-stroke bg-[#FFB020] px-4 py-2 text-stroke sm:px-6",
        className,
      )}
    >
      <Eye aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <p className="min-w-0 flex-1 font-body text-[15px] font-bold leading-snug">
        Viewing as {session.targetName} ({ROLE_LABEL[session.targetRole]}).{" "}
        <span className="font-medium">
          This simulation is read-only: nothing you do here changes their data.
        </span>
      </p>
      <Button size="sm" variant="secondary" loading={exiting} onClick={onExit}>
        Exit simulation
      </Button>
    </div>
  );
}
