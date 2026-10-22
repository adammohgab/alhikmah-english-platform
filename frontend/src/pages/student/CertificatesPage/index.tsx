import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CalendarDays, CheckCircle2, Download, GraduationCap, LockKeyhole, Printer, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { normalizeApiError } from "@/shared/api/error-normalizer";

type LooseResult = { data: unknown; error: { message: string; code?: string } | null };
type LooseClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<LooseResult>;
  from(table: string): { select(columns: string): { eq(column: string, value: string): PromiseLike<LooseResult> } };
};
const db = () => supabase as unknown as LooseClient;

type Certificate = { id: string; courseTitle: string; completedAt: string; hash: string };
type CertificateData = { studentName: string; certificates: Certificate[]; totalCourses: number };

function safeDate(value: string | null | undefined): string {
  if (!value) return "Completion date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Completion date unavailable" : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

async function fingerprint(value: string): Promise<string> {
  // A reproducible certificate fingerprint for display and matching; it is not a substitute for a server-issued signature.
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `LOCAL-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

async function fetchCertificates(studentId: string): Promise<CertificateData> {
  const client = db();
  const [coursesResult, profileResult, progressResult] = await Promise.all([
    client.rpc("my_courses", {}),
    client.from("profiles").select("display_name, username").eq("id", studentId),
    client.from("lesson_progress").select("course_id, completed_at, status, is_completed").eq("student_id", studentId),
  ]);
  for (const result of [coursesResult, profileResult, progressResult]) {
    if (result.error) throw new Error(normalizeApiError(result.error).message);
  }
  const courses = Array.isArray(coursesResult.data) ? coursesResult.data as Array<Record<string, unknown>> : [];
  const profileRows = Array.isArray(profileResult.data) ? profileResult.data as Array<Record<string, unknown>> : [];
  const progressRows = Array.isArray(progressResult.data) ? progressResult.data as Array<Record<string, unknown>> : [];
  const studentName = String(profileRows[0]?.display_name ?? profileRows[0]?.username ?? "Student");
  const completedCourses = courses.filter((course) => course.completed === true);
  const certificates = await Promise.all(completedCourses.map(async (course) => {
    const id = String(course.id ?? "");
    const courseProgress = progressRows.filter((row) => String(row.course_id ?? "") === id && (row.status === "completed" || row.is_completed === true));
    const dates = courseProgress.map((row) => String(row.completed_at ?? "")).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const completedAt = dates[0] ?? "";
    const hash = await fingerprint(`alhikmah-certificate-v1|${studentId}|${id}|${completedAt}`);
    return { id, courseTitle: String(course.title ?? "Completed course"), completedAt, hash };
  }));
  certificates.sort((a, b) => (new Date(b.completedAt).getTime() || 0) - (new Date(a.completedAt).getTime() || 0));
  return { studentName, certificates, totalCourses: courses.length };
}

function CertificateArtwork({ studentName, courseTitle, completedAt, hash }: { studentName: string; courseTitle: string; completedAt: string; hash: string }) {
  return (
    <article className="certificate-art relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden bg-[#fffdf5] px-8 py-10 text-center text-[#182c45] sm:px-14" aria-label={`${courseTitle} completion certificate`}>
      <div className="pointer-events-none absolute inset-[10px] border-[3px] border-[#c7a34c]" />
      <div className="pointer-events-none absolute inset-[17px] border border-[#c7a34c]/70" />
      <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#c7a34c] bg-[#f7e7b5] text-[#805c15] shadow-inner"><Award size={34} aria-hidden="true" /></div>
      <p className="relative text-xs font-bold uppercase tracking-[0.32em] text-[#96752d]">Al Hikmah · Achievement Award</p>
      <h2 className="relative mt-3 font-display text-3xl font-extrabold sm:text-5xl">Certificate of Completion</h2>
      <p className="relative mt-4 text-sm text-[#5a6471]">This certificate is proudly presented to</p>
      <p className="relative mt-2 border-b-2 border-[#c7a34c] px-6 pb-2 font-display text-3xl font-bold sm:text-4xl">{studentName}</p>
      <p className="relative mt-5 text-sm text-[#5a6471]">for successfully completing the course</p>
      <h3 className="relative mt-2 max-w-3xl font-heading text-2xl font-bold sm:text-3xl">{courseTitle}</h3>
      <p className="relative mt-4 flex items-center gap-2 text-sm"><CalendarDays size={16} aria-hidden="true" /> {safeDate(completedAt)}</p>
      <div className="relative mt-6 grid w-full max-w-2xl grid-cols-2 gap-6 border-t border-[#d8c58e] pt-4 text-left text-xs text-[#5a6471]">
        <div><p className="font-semibold text-[#182c45]">School / Authorized signature</p><div className="mt-5 border-b border-[#9c8a60]" /><p className="mt-1">Al Hikmah Private School</p></div>
        <div className="text-right"><p className="font-semibold text-[#182c45]">Certificate fingerprint</p><p className="mt-2 break-all font-mono text-[9px] leading-relaxed">{hash}</p><p className="mt-1">Reference for matching this certificate</p></div>
      </div>
    </article>
  );
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["student", "certificates", user?.id], queryFn: () => fetchCertificates(user!.id), enabled: Boolean(user?.id), staleTime: 30_000 });
  const selected = useMemo(() => query.data?.certificates.find((certificate) => certificate.id === selectedId) ?? null, [query.data, selectedId]);

  const printCertificate = () => {
    if (!selected) return;
    window.print();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          body * { visibility: hidden !important; }
          .certificate-print-root, .certificate-print-root * { visibility: visible !important; }
          .certificate-print-root { position: fixed !important; inset: 0 !important; z-index: 99999 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: white !important; padding: 0 !important; }
          .certificate-art { width: 100% !important; height: 190mm !important; min-height: 0 !important; max-height: 190mm !important; box-shadow: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Your milestones</p><h1 className="mt-1 font-display text-3xl font-extrabold text-stroke sm:text-4xl">Certificates</h1><p className="mt-2 max-w-2xl text-sm text-muted">Celebrate the courses you have completed. Open a certificate to print it or save it as a PDF.</p></div>
        <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-surface px-4 py-3 shadow-hard-sm"><GraduationCap size={22} aria-hidden="true"/><span className="text-sm font-bold">{query.data?.certificates.length ?? 0} earned</span></div>
      </header>

      {query.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} shape="rect" className="h-56 w-full" label="Loading certificates…" />)}</div> : query.isError ? <ErrorState description="Your certificates could not be loaded. Check your connection and try again." onRetry={() => void query.refetch()} /> : (
        <>
          {query.data.certificates.length > 0 ? <section aria-label="Earned certificates" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.certificates.map((certificate) => <Card key={certificate.id} hoverable className="overflow-hidden p-0"><button type="button" onClick={() => setSelectedId(certificate.id)} className="group block w-full text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent"><div className="relative flex h-36 flex-col items-center justify-center overflow-hidden bg-[#fff9e8] p-4 text-center text-[#182c45]"><div className="absolute inset-2 border-2 border-[#c7a34c]"/><div className="absolute inset-3 border border-[#c7a34c]/60"/><Award size={30} className="relative text-[#b28b32]" aria-hidden="true"/><p className="relative mt-2 text-[10px] font-bold uppercase tracking-[0.22em]">Certificate of Completion</p><p className="relative mt-1 line-clamp-1 max-w-full font-heading text-lg font-bold">{certificate.courseTitle}</p></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-lg font-bold">{certificate.courseTitle}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><CalendarDays size={14} aria-hidden="true"/>{safeDate(certificate.completedAt)}</p></div><span className="rounded-full border border-emerald-700/30 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"><CheckCircle2 size={12} className="mr-1 inline"/>Earned</span></div><p className="mt-3 truncate font-mono text-[10px] text-muted">Fingerprint: {certificate.hash}</p><p className="mt-3 flex items-center gap-1 text-sm font-bold text-accent">View certificate <Download size={14} aria-hidden="true"/></p></div></button></Card>)}</section> : <Card className="flex flex-col items-center px-6 py-12 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-[#fff2c8] text-[#946c18] shadow-hard-sm"><LockKeyhole size={30} aria-hidden="true"/></div><h2 className="mt-5 font-display text-2xl font-bold">Your first certificate is waiting</h2><p className="mt-2 max-w-md text-sm text-muted">Finish every lesson in a course to earn a completion certificate. Your earned certificates will appear here.</p><div className="mt-5 flex items-center gap-2 rounded-lg bg-surface-secondary px-4 py-3 text-sm"><ShieldCheck size={18} aria-hidden="true"/>Certificates are based on your recorded course progress.</div></Card>}
          {query.data.certificates.length < query.data.totalCourses && <section className="rounded-xl border-2 border-dashed border-border p-4"><h2 className="flex items-center gap-2 font-heading font-bold"><LockKeyhole size={17} aria-hidden="true"/>Still to earn</h2><p className="mt-1 text-sm text-muted">Complete your remaining courses to unlock more certificates.</p><p className="mt-2 text-xs text-muted">{query.data.totalCourses - query.data.certificates.length} course{query.data.totalCourses - query.data.certificates.length === 1 ? "" : "s"} not yet completed</p></section>}
        </>
      )}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={`${selected.courseTitle} certificate`}><div className="certificate-print-root flex max-h-[96vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="no-print flex items-center justify-between gap-3 border-b border-border p-3 sm:px-5"><div><p className="font-heading font-bold">Certificate preview</p><p className="text-xs text-muted">Choose “Save as PDF” in your browser’s print dialog.</p></div><div className="flex items-center gap-2"><Button onClick={printCertificate}><Printer size={16} aria-hidden="true"/> Print / Download PDF</Button><button type="button" onClick={() => setSelectedId(null)} aria-label="Close certificate" className="rounded-lg p-2 hover:bg-surface-secondary"><X size={20}/></button></div></div><div className="p-2 sm:p-5"><CertificateArtwork studentName={query.data?.studentName ?? "Student"} courseTitle={selected.courseTitle} completedAt={selected.completedAt} hash={selected.hash}/></div><div className="no-print flex justify-end p-3 pt-0"><Button variant="secondary" onClick={() => setSelectedId(null)}>Close</Button></div></div></div>}
    </main>
  );
}
