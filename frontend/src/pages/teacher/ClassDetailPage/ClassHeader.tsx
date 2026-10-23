import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { useToast } from "@/shared/hooks/useToast";
import type { ClassOverview } from "./api";
import { formatJoinCode, joinLink } from "./rules";

/* ========================================
   Class header (TEACHER-SPEC TC-03): class name, grade, term, co-teacher avatars, a join code
   chip that copies the join link, and a quick-invite dialog with the code and a QR code.
   ======================================== */

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Loaded on demand so the QR encoder stays out of the main bundle.
    import("qrcode")
      .then((qr) => qr.toDataURL(value, { margin: 1, width: 224 }))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (failed) return <p className="text-sm text-muted">The QR code could not be drawn.</p>;
  if (!src) return <div className="h-56 w-56 animate-pulse rounded-[12px] bg-surface-100" aria-hidden="true" />;
  return (
    <img
      src={src}
      width={224}
      height={224}
      alt="QR code that opens the class join link"
      className="rounded-[12px] border-2 border-stroke bg-white"
    />
  );
}

export function ClassHeader({ data }: { data: ClassOverview }) {
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { class: cls, term, teachers } = data;
  const code = cls.join_code ?? null;
  const enabled = cls.join_code_enabled !== false && code !== null;
  const link = code
    ? joinLink(window.location.origin, import.meta.env.BASE_URL ?? "/", code)
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ type: "success", title: "Join link copied", description: link });
    } catch {
      toast.show({
        type: "error",
        title: "Could not copy",
        description: "Copy the link by hand: " + link,
      });
    }
  };

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm">
      <div className="min-w-0 space-y-2">
        <h1 className="truncate font-display text-2xl font-extrabold">{cls.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {cls.grade_level && <Chip size="sm">Grade {cls.grade_level}</Chip>}
          {term && <Chip size="sm">{term.name}</Chip>}
          <Chip size="sm">{data.stats.students} students</Chip>
        </div>
        {teachers.length > 0 && (
          <ul className="flex items-center gap-1" aria-label="Teachers">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <Avatar size="sm" name={teacher.full_name} src={teacher.avatar_url} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {code && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!enabled}
            aria-label={`Copy join link for code ${code}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border-2 border-stroke bg-surface-100 px-3 font-mono text-sm font-extrabold shadow-retro-sm disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Copy size={16} aria-hidden="true" /> {formatJoinCode(code)}
          </button>
          <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!enabled}>
            <QrCode size={16} aria-hidden="true" /> Quick invite
          </Button>
          {!enabled && <Chip size="sm">Join code is off</Chip>}
        </div>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite students"
        description="Students can scan the QR code or enter the class code."
      >
        <div className="flex flex-col items-center gap-3">
          {link && <QrImage value={link} />}
          <p className="font-mono text-3xl font-extrabold tracking-widest" data-testid="invite-code">
            {code ? formatJoinCode(code) : ""}
          </p>
          <p className="break-all text-center text-sm text-muted">{link}</p>
          <Button onClick={() => void copy()}>
            <Copy size={16} aria-hidden="true" /> Copy link
          </Button>
        </div>
      </Dialog>
    </header>
  );
}
