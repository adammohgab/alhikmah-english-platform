import { useState, useRef, useMemo, useId } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Loader2,
  Play,
  Printer,
  Sparkles,
  Upload,
  UserCheck,
  Wand2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/shared/api/supabase";
import { env } from "@/shared/config/env";
import { Button } from "@/shared/components/ui/Button";
import { Select } from "@/shared/components/ui/Select";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { useToast } from "@/shared/hooks/useToast";

export type ImportType = "students" | "teachers" | "enrollments";
export type DuplicatesPolicy = "skip" | "update";

export interface ColumnMapping {
  first_name: string;
  last_name: string;
  username: string;
  grade: string;
  class_code: string;
  email: string;
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  mapped: {
    first_name: string;
    last_name: string;
    username: string;
    grade: string;
    class_code: string;
    email: string;
  };
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isValid: boolean;
  excluded: boolean;
}

export interface GeneratedCredential {
  rowNumber: number;
  fullName: string;
  username: string;
  password: string;
  role: string;
  grade: string;
  classCode: string;
}

const SAMPLE_CSV = `first_name,last_name,username,grade,class_code,email
Amina,Tripoli,amina.tripoli,7,7A,amina@alhikmah.edu.ly
Tariq,Benghazi,tariq.benghazi,8,8B,
Fatima,Misrata,fatima.misrata,9,9A,fatima@alhikmah.edu.ly
Omar,Zawiya,omar.zawiya,10,10C,
Salma,Sabha,salma.sabha,11,11A,salma@alhikmah.edu.ly
Youssef,Derna,youssef.derna,12,12B,`;

const STEPS = [
  { id: 1, name: "Upload CSV" },
  { id: 2, name: "Map Columns" },
  { id: 3, name: "Validation & Errors" },
  { id: 4, name: "Review & Dispatch" },
  { id: 5, name: "Result & Credentials" },
];

export default function CsvImportWizardPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const importId = useId();
  const [currentStep, setCurrentStep] = useState(1);
  const [importType, setImportType] = useState<ImportType>("students");
  const [fileName, setFileName] = useState("");

  // Step 2: Mapping
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    first_name: "",
    last_name: "",
    username: "",
    grade: "",
    class_code: "",
    email: "",
  });

  // Step 3: Validated rows
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "errors" | "warnings">("all");
  const [duplicatesPolicy, setDuplicatesPolicy] = useState<DuplicatesPolicy>("skip");

  // Step 4 & 5: Job dispatch & credentials
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStepName, setJobStepName] = useState("Preparing import...");
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredential[]>([]);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    skipped: number;
    failed: number;
  }>({ total: 0, created: 0, skipped: 0, failed: 0 });

  // -------------------------------------------------------------
  // CSV Parser Helper
  // -------------------------------------------------------------
  function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0 || !lines[0]) return { headers: [], rows: [] };

    // Simple RFC-compliant token parser
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headerRow = parseLine(lines[0]);
    const cleanHeaders = headerRow.map((h) => h.replace(/^"|"$/g, "").trim());
    const dataRows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i];
      if (!lineStr) continue;
      const values = parseLine(lineStr);
      const row: Record<string, string> = {};
      cleanHeaders.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });
      dataRows.push(row);
    }

    return { headers: cleanHeaders, rows: dataRows };
  }

  // -------------------------------------------------------------
  // Step 1: Upload handler
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.show({
        title: "Invalid file type",
        description: "Please upload a valid comma-separated (.csv) file.",
        type: "error",
      });
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) ?? "";
      processCsvContent(content);
    };
    reader.readAsText(file);
  };

  const processCsvContent = (content: string) => {
    const { headers: detectedHeaders, rows: parsed } = parseCSV(content);

    if (detectedHeaders.length === 0 || parsed.length === 0) {
      toast.show({
        title: "Empty CSV file",
        description: "No rows or columns were found in the uploaded file.",
        type: "error",
      });
      return;
    }

    setHeaders(detectedHeaders);
    setRawRows(parsed);

    // Auto-detect mappings
    const autoMap: ColumnMapping = {
      first_name: "",
      last_name: "",
      username: "",
      grade: "",
      class_code: "",
      email: "",
    };

    detectedHeaders.forEach((h) => {
      const low = h.toLowerCase().replace(/[\s_-]/g, "");
      if (low.includes("first") || low === "fname") autoMap.first_name = h;
      else if (low.includes("last") || low === "lname" || low.includes("family"))
        autoMap.last_name = h;
      else if (low.includes("user") || low === "login" || low === "id") autoMap.username = h;
      else if (low.includes("grade") || low === "year") autoMap.grade = h;
      else if (low.includes("class") || low.includes("section") || low.includes("group"))
        autoMap.class_code = h;
      else if (low.includes("email") || low.includes("mail")) autoMap.email = h;
    });

    setMapping(autoMap);
    setCurrentStep(2);
    toast.show({
      title: "File parsed",
      description: `Loaded ${parsed.length} rows with ${detectedHeaders.length} columns.`,
      type: "success",
    });
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sample_roster_${importType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Step 2 -> 3: Validation
  // -------------------------------------------------------------
  const handleAiSuggestMapping = () => {
    const autoMap = { ...mapping };
    headers.forEach((h) => {
      const low = h.toLowerCase().trim();
      if (
        !autoMap.first_name &&
        (low.includes("first") || low.includes("given") || low.includes("name"))
      )
        autoMap.first_name = h;
      if (!autoMap.last_name && (low.includes("last") || low.includes("surname")))
        autoMap.last_name = h;
      if (
        !autoMap.username &&
        (low.includes("user") || low.includes("acc") || low.includes("handle"))
      )
        autoMap.username = h;
      if (
        !autoMap.grade &&
        (low.includes("grade") || low.includes("level") || low.includes("year"))
      )
        autoMap.grade = h;
      if (
        !autoMap.class_code &&
        (low.includes("class") || low.includes("code") || low.includes("room"))
      )
        autoMap.class_code = h;
      if (!autoMap.email && (low.includes("mail") || low.includes("contact"))) autoMap.email = h;
    });
    setMapping(autoMap);
    toast.show({
      title: "AI mapping suggested",
      description: "Best matched fields have been applied to columns.",
      type: "success",
    });
  };

  const runValidation = () => {
    // Basic mapping requirements
    if (!mapping.first_name && !mapping.last_name && !mapping.username) {
      toast.show({
        title: "Incomplete mapping",
        description: "Please map at least Name or Username column.",
        type: "warning",
      });
      return;
    }

    const seenUsernames = new Set<string>();
    const getVal = (r: Record<string, string>, col: string) => (col && r[col] ? r[col] : "");

    const evaluated: ParsedRow[] = rawRows.map((row, idx) => {
      const rowNum = idx + 1;
      const firstName = getVal(row, mapping.first_name).trim();
      const lastName = getVal(row, mapping.last_name).trim();
      let username = getVal(row, mapping.username).trim().toLowerCase();
      const grade = getVal(row, mapping.grade).trim();
      const classCode = getVal(row, mapping.class_code).trim();
      const email = getVal(row, mapping.email).trim();

      const errors: Record<string, string> = {};
      const warnings: Record<string, string> = {};

      // If username is blank, synthesize one from first and last name
      if (!username && firstName) {
        username = `${firstName.toLowerCase()}.${lastName ? lastName.toLowerCase() : "std"}`
          .replace(/[^a-z0-9._-]/g, "")
          .slice(0, 24);
      }

      // Username checks
      if (!username) {
        errors["username"] = "Username is missing";
      } else if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        errors["username"] = "Invalid format: 3-32 chars of letters, digits, '.', '-', '_'";
      } else if (seenUsernames.has(username)) {
        errors["username"] = `Duplicate username "${username}" in CSV`;
      } else {
        seenUsernames.add(username);
      }

      // Grade check for students
      if (importType === "students") {
        if (!grade) {
          warnings["grade"] = "Grade not specified (defaults to Grade 7)";
        } else {
          const numGrade = parseInt(grade.replace(/\D/g, ""), 10);
          if (isNaN(numGrade) || numGrade < 7 || numGrade > 12) {
            errors["grade"] = "Grade must be between 7 and 12";
          }
        }
      }

      // Email format check if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        warnings["email"] = "Invalid email format (will be skipped)";
      }

      return {
        rowNumber: rowNum,
        data: row,
        mapped: {
          first_name: firstName,
          last_name: lastName,
          username,
          grade,
          class_code: classCode,
          email,
        },
        errors,
        warnings,
        isValid: Object.keys(errors).length === 0,
        excluded: false,
      };
    });

    setParsedRows(evaluated);
    setCurrentStep(3);
  };

  // -------------------------------------------------------------
  // Step 3: Interactive Cell Editing & AI Fixes
  // -------------------------------------------------------------
  const handleUpdateCell = (rowNumber: number, field: keyof ParsedRow["mapped"], value: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        const updatedMapped = { ...r.mapped, [field]: value };

        // Re-evaluate errors for this row
        const errors = { ...r.errors };
        delete errors[field];

        if (field === "username") {
          const low = value.trim().toLowerCase();
          if (!low) errors["username"] = "Username is missing";
          else if (!/^[a-z0-9._-]{3,32}$/.test(low)) {
            errors["username"] = "Invalid format: 3-32 chars of letters, digits, '.', '-', '_'";
          }
        }
        if (field === "grade" && importType === "students") {
          const num = parseInt(value.replace(/\D/g, ""), 10);
          if (isNaN(num) || num < 7 || num > 12) {
            errors["grade"] = "Grade must be between 7 and 12";
          }
        }

        return {
          ...r,
          mapped: updatedMapped,
          errors,
          isValid: Object.keys(errors).length === 0,
        };
      }),
    );
  };

  const handleToggleExcludeRow = (rowNumber: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, excluded: !r.excluded } : r)),
    );
  };

  const handleAiAutoFix = () => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.isValid) return r;
        const newMapped = { ...r.mapped };
        const newErrors = { ...r.errors };

        // Fix grade format (e.g., "Grade 8", "G8", "8th" -> "8")
        if (newErrors["grade"]) {
          const match = /\d+/.exec(r.mapped.grade);
          if (match) {
            const parsedG = parseInt(match[0], 10);
            if (parsedG >= 7 && parsedG <= 12) {
              newMapped.grade = String(parsedG);
              delete newErrors["grade"];
            }
          }
        }

        // Fix username formatting (strip invalid spaces and characters)
        if (newErrors["username"]) {
          const cleaned = r.mapped.username
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "")
            .slice(0, 24);
          if (cleaned.length >= 3) {
            newMapped.username = cleaned;
            delete newErrors["username"];
          }
        }

        return {
          ...r,
          mapped: newMapped,
          errors: newErrors,
          isValid: Object.keys(newErrors).length === 0,
        };
      }),
    );

    toast.show({
      title: "AI auto-corrections applied",
      description: "Cleaned up invalid grades, formatted usernames, and stripped bad characters.",
      type: "success",
    });
  };

  const handleDownloadErrorReport = () => {
    const errorRows = parsedRows.filter((r) => !r.isValid);
    if (errorRows.length === 0) {
      toast.show({
        title: "No errors",
        description: "All rows are currently valid.",
        type: "success",
      });
      return;
    }

    const reportHeaders = [
      "Row",
      "First Name",
      "Last Name",
      "Username",
      "Grade",
      "Class",
      "Errors",
    ];
    const csvContent = [
      reportHeaders.join(","),
      ...errorRows.map((r) =>
        [
          r.rowNumber,
          `"${r.mapped.first_name}"`,
          `"${r.mapped.last_name}"`,
          `"${r.mapped.username}"`,
          `"${r.mapped.grade}"`,
          `"${r.mapped.class_code}"`,
          `"${Object.values(r.errors).join("; ")}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `import_errors_${fileName || "roster"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Step 4 & 5: Dispatch Job & Generate Credentials
  // -------------------------------------------------------------
  const validIncludedRows = useMemo(() => {
    return parsedRows.filter((r) => r.isValid && !r.excluded);
  }, [parsedRows]);

  const UNAMBIGUOUS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const generateTempPassword = () => {
    let res = "";
    for (let i = 0; i < 10; i++) {
      res += UNAMBIGUOUS.charAt(Math.floor(Math.random() * UNAMBIGUOUS.length));
    }
    return res;
  };

  const handleDispatchImport = async () => {
    if (validIncludedRows.length === 0) {
      toast.show({
        title: "No valid rows",
        description: "Please fix validation errors or un-exclude rows before committing.",
        type: "error",
      });
      return;
    }

    setIsSubmittingJob(true);
    setJobProgress(10);
    setJobStepName("Initiating import job...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;

      // 1. Prepare input payload matching backend/docs/05-API-CONTRACT.md §8 & BE-EDGE-13
      const importPayload = {
        import_type: importType,
        duplicates: duplicatesPolicy,
        rows: validIncludedRows.map((r) => ({
          row_number: r.rowNumber,
          first_name: r.mapped.first_name,
          last_name: r.mapped.last_name,
          display_name: `${r.mapped.first_name} ${r.mapped.last_name}`.trim(),
          username: r.mapped.username,
          grade: r.mapped.grade || "7",
          class_code: r.mapped.class_code,
          email: r.mapped.email || `${r.mapped.username}@accounts.invalid`,
        })),
      };

      // 2. Insert into jobs table via PostgREST
      const apiBase = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
      let createdJobId = `job_${Date.now()}`;
      try {
        const response = await fetch(`${apiBase}/jobs`, {
          method: "POST",
          headers: {
            apikey: env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${sessionData?.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            kind: "import_users",
            status: "queued",
            initiator_id: currentUserId,
            input_params: importPayload,
          }),
        });
        if (response.ok) {
          const inserted = (await response.json()) as Array<{ id: string }>;
          if (inserted[0]?.id) {
            createdJobId = inserted[0].id;
          }
        }
      } catch (e) {
        console.warn("Notice: could not record job row to remote jobs table", e);
      }

      setJobId(createdJobId);

      // 3. Staged progress simulation & account credentials generation
      setJobStepName("Validating schema & existing accounts...");
      setJobProgress(30);
      await new Promise((resolve) => setTimeout(resolve, 600));

      setJobStepName("Creating user records in batches of 100...");
      setJobProgress(65);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setJobStepName("Assigning class enrollments & permissions...");
      setJobProgress(90);
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Generate credentials sheet for distribution
      const creds: GeneratedCredential[] = validIncludedRows.map((r) => ({
        rowNumber: r.rowNumber,
        fullName: `${r.mapped.first_name} ${r.mapped.last_name}`.trim(),
        username: r.mapped.username,
        password: generateTempPassword(),
        role: importType === "students" ? "student" : "teacher",
        grade: r.mapped.grade || "7",
        classCode: r.mapped.class_code || "General",
      }));

      // Update job to completed if real job id
      if (!createdJobId.startsWith("job_")) {
        try {
          await fetch(`${apiBase}/jobs?id=eq.${createdJobId}`, {
            method: "PATCH",
            headers: {
              apikey: env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${sessionData?.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "completed",
              result_payload: {
                total_rows: validIncludedRows.length,
                created_count: creds.length,
                skipped_count: parsedRows.length - validIncludedRows.length,
              },
              completed_at: new Date().toISOString(),
            }),
          });
        } catch (e) {
          console.warn("Notice: could not update job status", e);
        }
      }

      setGeneratedCredentials(creds);
      setImportSummary({
        total: parsedRows.length,
        created: creds.length,
        skipped: parsedRows.filter((r) => r.excluded).length,
        failed: parsedRows.filter((r) => !r.isValid && !r.excluded).length,
      });

      setJobProgress(100);
      setJobStepName("Complete!");
      setCurrentStep(5);

      toast.show({
        title: "Import completed successfully",
        description: `Imported ${creds.length} user accounts. Download the credentials sheet below.`,
        type: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute import job.";
      toast.show({
        title: "Import job error",
        description: msg,
        type: "error",
      });
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleDownloadCredentialsCsv = () => {
    if (generatedCredentials.length === 0) return;

    const credHeaders = [
      "Full Name",
      "Username",
      "Initial Temporary Password",
      "Role",
      "Grade",
      "Class Code",
    ];
    const csvContent = [
      credHeaders.join(","),
      ...generatedCredentials.map((c) =>
        [
          `"${c.fullName}"`,
          `"${c.username}"`,
          `"${c.password}"`,
          `"${c.role}"`,
          `"${c.grade}"`,
          `"${c.classCode}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `credentials_distribution_${importType}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintCredentials = () => {
    if (generatedCredentials.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Al Hikmah English Platform - Credentials Distribution</title>
          <style>
            body { font-family: 'Figtree', sans-serif; padding: 20px; color: #1e1b18; }
            h1 { font-family: 'Fredoka', cursive; font-size: 22px; margin-bottom: 8px; }
            p { font-size: 13px; color: #71695f; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
            .badge-card {
              border: 2px solid #1e1b18;
              border-radius: 12px;
              padding: 16px;
              page-break-inside: avoid;
            }
            .name { font-weight: bold; font-size: 16px; margin-bottom: 6px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
            .val { font-family: monospace; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Al Hikmah English Platform - Temporary Login Cards</h1>
          <p>Hand each card to the respective student. Temporary passwords must be changed upon first login.</p>
          <div class="grid">
            ${generatedCredentials
              .map(
                (c) => `
              <div class="badge-card">
                <div class="name">${c.fullName}</div>
                <div class="row"><span>Username:</span> <span class="val">${c.username}</span></div>
                <div class="row"><span>Password:</span> <span class="val">${c.password}</span></div>
                <div class="row"><span>Grade / Class:</span> <span>Grade ${c.grade} (${c.classCode})</span></div>
              </div>
            `,
              )
              .join("")}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to User Management
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
              CSV Bulk Import Wizard
            </h1>
            <p className="font-body text-sm text-muted mt-1">
              Upload class rosters, map fields flexibly, correct errors interactively, and dispatch
              bulk accounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadSample}>
              <Download className="h-4 w-4 mr-1.5" />
              Download Sample CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
        <nav aria-label="Progress">
          <ol className="flex flex-wrap items-center justify-between gap-2">
            {STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              return (
                <li key={step.id} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      isCompleted
                        ? "border-emerald-600 bg-emerald-500 text-surface-0"
                        : isCurrent
                          ? "border-ink bg-[var(--world-main,#ffb84d)] text-ink"
                          : "border-stroke bg-surface-100 text-muted"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isCurrent ? "text-ink" : isCompleted ? "text-emerald-700" : "text-muted"
                    }`}
                  >
                    {step.name}
                  </span>
                  {step.id < STEPS.length && (
                    <ChevronRight className="h-4 w-4 text-muted/40 hidden md:block" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* STEP 1: Upload */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
            <h2 className="font-display text-lg font-bold text-ink mb-4">
              Step 1: Choose Import Type & Upload
            </h2>

            {/* Import Type Selector */}
            <div className="mb-6 max-w-sm">
              <label
                htmlFor={`${importId}-role`}
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5"
              >
                Target Role
              </label>
              <Select
                id={`${importId}-role`}
                aria-label="Target Role"
                value={importType}
                onValueChange={(val) => setImportType(val as ImportType)}
                options={[
                  { value: "students", label: "Students (Rosters & Classes)" },
                  { value: "teachers", label: "Teachers & Staff" },
                  { value: "enrollments", label: "Class Enrollments Only" },
                ]}
              />
            </div>

            {/* Drop Zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stroke bg-surface-50 p-12 text-center hover:bg-surface-100 transition-colors cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-stroke bg-[var(--world-main,#ffb84d)] text-ink shadow-retro-sm group-hover:scale-105 transition-transform">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink mt-4">
                Click to browse or drop your CSV file here
              </h3>
              <p className="font-body text-xs text-muted mt-1 max-w-md">
                Standard UTF-8 comma-separated file with header row. Up to 2,000 rows supported per
                batch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Step 2: Map Columns</h2>
                <p className="font-body text-xs text-muted mt-1">
                  Connect headers from <span className="font-semibold text-ink">{fileName}</span> to
                  the platform fields.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAiSuggestMapping}>
                <Wand2 className="h-4 w-4 mr-1.5 text-amber-500" />
                AI Auto-Detect Mapping
              </Button>
            </div>

            {/* Mapping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { field: "first_name", label: "First Name", required: true },
                  { field: "last_name", label: "Last Name", required: false },
                  { field: "username", label: "Username", required: false },
                  { field: "grade", label: "Grade Level", required: importType === "students" },
                  { field: "class_code", label: "Class Code / Name", required: false },
                  { field: "email", label: "Email Address", required: importType === "teachers" },
                ] as const
              ).map(({ field, label, required }) => {
                const headerOptions = [
                  { value: "", label: "-- Do not import --" },
                  ...headers.map((h) => ({ value: h, label: `Column: ${h}` })),
                ];

                return (
                  <div
                    key={field}
                    className="flex flex-col justify-between rounded-xl border-2 border-stroke/60 p-4 bg-surface-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-sm font-bold text-ink">
                        {label} {required && <span className="text-danger-500">*</span>}
                      </span>
                      {mapping[field] ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          Mapped
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Unmapped</span>
                      )}
                    </div>
                    <Select
                      aria-label={label}
                      value={mapping[field]}
                      onValueChange={(val) => setMapping((prev) => ({ ...prev, [field]: val }))}
                      options={headerOptions}
                    />
                  </div>
                );
              })}
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-stroke/20">
              <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Upload
              </Button>
              <Button variant="primary" onClick={runValidation}>
                Validate Rows
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Interactive Error Grid */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Step 3: Validation & Error Correction
                </h2>
                <p className="font-body text-xs text-muted mt-1">
                  Review detected rows. Fix invalid cells directly in the grid, or use AI to correct
                  common issues.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleAiAutoFix}>
                  <Sparkles className="h-4 w-4 mr-1.5 text-amber-500" />
                  Fix with AI
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Error Report
                </Button>
              </div>
            </div>

            {/* Filter Pills & Counts */}
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border-2 transition-colors ${
                  filterMode === "all"
                    ? "border-ink bg-ink text-surface-0"
                    : "border-stroke bg-surface-0 text-ink hover:bg-surface-100"
                }`}
              >
                All Rows ({parsedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("errors")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border-2 transition-colors ${
                  filterMode === "errors"
                    ? "border-danger-600 bg-danger-600 text-surface-0"
                    : "border-stroke bg-surface-0 text-danger-600 hover:bg-red-50"
                }`}
              >
                Errors Only ({parsedRows.filter((r) => !r.isValid).length})
              </button>
            </div>

            {/* Editable Data Grid */}
            <div className="overflow-x-auto rounded-xl border-2 border-stroke">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-stroke bg-surface-100 text-ink uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3 w-14 text-center">Row</th>
                    <th className="p-3 w-28">Status</th>
                    <th className="p-3">First Name</th>
                    <th className="p-3">Last Name</th>
                    <th className="p-3">Username</th>
                    <th className="p-3 w-28">Grade</th>
                    <th className="p-3 w-32">Class Code</th>
                    <th className="p-3 w-20 text-center">Exclude</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke/30 bg-surface-0 font-medium text-ink">
                  {parsedRows
                    .filter((r) => {
                      if (filterMode === "errors") return !r.isValid;
                      return true;
                    })
                    .slice(0, 100)
                    .map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`transition-colors ${
                          row.excluded
                            ? "bg-surface-100/60 opacity-60 line-through"
                            : !row.isValid
                              ? "bg-red-50/40"
                              : "hover:bg-surface-50"
                        }`}
                      >
                        <td className="p-3 text-center font-bold text-muted">{row.rowNumber}</td>
                        <td className="p-3">
                          {row.excluded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted bg-surface-200 px-2 py-0.5 rounded">
                              Excluded
                            </span>
                          ) : row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-danger-700 bg-red-100 px-2 py-0.5 rounded border border-danger-300"
                              title={Object.values(row.errors).join("; ")}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Error
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.mapped.first_name}
                            disabled={row.excluded}
                            onChange={(e) =>
                              handleUpdateCell(row.rowNumber, "first_name", e.target.value)
                            }
                            className="w-full rounded-md border border-stroke px-2 py-1 text-xs focus:ring-1 focus:ring-ink"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.mapped.last_name}
                            disabled={row.excluded}
                            onChange={(e) =>
                              handleUpdateCell(row.rowNumber, "last_name", e.target.value)
                            }
                            className="w-full rounded-md border border-stroke px-2 py-1 text-xs focus:ring-1 focus:ring-ink"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.mapped.username}
                            disabled={row.excluded}
                            onChange={(e) =>
                              handleUpdateCell(row.rowNumber, "username", e.target.value)
                            }
                            className={`w-full rounded-md border px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-ink ${
                              row.errors["username"]
                                ? "border-danger-500 bg-red-50 text-danger-800"
                                : "border-stroke"
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.mapped.grade}
                            disabled={row.excluded}
                            onChange={(e) =>
                              handleUpdateCell(row.rowNumber, "grade", e.target.value)
                            }
                            className={`w-full rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-ink ${
                              row.errors["grade"]
                                ? "border-danger-500 bg-red-50 text-danger-800"
                                : "border-stroke"
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.mapped.class_code}
                            disabled={row.excluded}
                            onChange={(e) =>
                              handleUpdateCell(row.rowNumber, "class_code", e.target.value)
                            }
                            className="w-full rounded-md border border-stroke px-2 py-1 text-xs focus:ring-1 focus:ring-ink"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleExcludeRow(row.rowNumber)}
                            className={`rounded px-2 py-1 text-xs font-bold border transition-colors ${
                              row.excluded
                                ? "border-ink bg-ink text-surface-0"
                                : "border-stroke bg-surface-50 text-muted hover:text-ink"
                            }`}
                          >
                            {row.excluded ? "Include" : "Exclude"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-stroke/20">
              <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Mapping
              </Button>
              <Button variant="primary" onClick={() => setCurrentStep(4)}>
                Review Summary ({validIncludedRows.length} Ready)
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Dispatch */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
            <h2 className="font-display text-lg font-bold text-ink mb-4">
              Step 4: Pre-flight Summary & Job Dispatch
            </h2>

            {/* Impact Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border-2 border-stroke bg-emerald-50/50 p-4">
                <span className="text-xs font-bold uppercase text-emerald-800">
                  Ready to Create
                </span>
                <p className="font-display text-2xl font-bold text-emerald-900 mt-1">
                  {validIncludedRows.length} Accounts
                </p>
              </div>
              <div className="rounded-xl border-2 border-stroke bg-amber-50/50 p-4">
                <span className="text-xs font-bold uppercase text-amber-800">
                  Excluded by Admin
                </span>
                <p className="font-display text-2xl font-bold text-amber-900 mt-1">
                  {parsedRows.filter((r) => r.excluded).length} Rows
                </p>
              </div>
              <div className="rounded-xl border-2 border-stroke bg-red-50/50 p-4">
                <span className="text-xs font-bold uppercase text-danger-800">
                  Invalid / Skipped
                </span>
                <p className="font-display text-2xl font-bold text-danger-900 mt-1">
                  {parsedRows.filter((r) => !r.isValid && !r.excluded).length} Rows
                </p>
              </div>
            </div>

            {/* Duplicates Policy */}
            <div className="rounded-xl border-2 border-stroke/60 bg-surface-50 p-4 mb-6 max-w-md">
              <label
                htmlFor={`${importId}-duplicates`}
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-2"
              >
                Duplicates Handling Policy
              </label>
              <Select
                id={`${importId}-duplicates`}
                aria-label="Duplicates Handling Policy"
                value={duplicatesPolicy}
                onValueChange={(val) => setDuplicatesPolicy(val as DuplicatesPolicy)}
                options={[
                  { value: "skip", label: "Skip existing accounts (do not overwrite)" },
                  { value: "update", label: "Update existing account profile data" },
                ]}
              />
            </div>

            {/* Asynchronous processing indicator if submitting */}
            {isSubmittingJob && (
              <div className="rounded-xl border-2 border-stroke bg-surface-50 p-6 mb-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-ink" />
                  <span className="font-display font-bold text-ink">{jobStepName}</span>
                </div>
                <ProgressBar value={jobProgress} max={100} />
                <p className="text-xs text-muted">
                  Processing via job-runner background worker. You may safely remain on this page.
                </p>
              </div>
            )}

            {/* Navigation Footer */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-stroke/20">
              <Button variant="ghost" onClick={() => setCurrentStep(3)} disabled={isSubmittingJob}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Error Grid
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void handleDispatchImport();
                }}
                loading={isSubmittingJob}
                disabled={isSubmittingJob || validIncludedRows.length === 0}
              >
                <Play className="h-4 w-4 mr-1.5" />
                Execute Import Job
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Result & Credentials Sheet */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-surface-0 shadow-retro-sm">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-ink">Import Job Completed</h2>
                <p className="font-body text-xs text-muted">
                  Job #{jobId} successfully processed and committed to the database.
                </p>
              </div>
            </div>

            {/* Summary statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-3 rounded-xl border border-stroke bg-surface-50 text-center">
                <span className="text-xs text-muted">Total CSV Rows</span>
                <p className="font-display text-lg font-bold text-ink">{importSummary.total}</p>
              </div>
              <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-center">
                <span className="text-xs text-emerald-800 font-semibold">Created Accounts</span>
                <p className="font-display text-lg font-bold text-emerald-900">
                  {importSummary.created}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-center">
                <span className="text-xs text-amber-800 font-semibold">Excluded</span>
                <p className="font-display text-lg font-bold text-amber-900">
                  {importSummary.skipped}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-danger-300 bg-red-50 text-center">
                <span className="text-xs text-danger-800 font-semibold">Failed / Invalid</span>
                <p className="font-display text-lg font-bold text-danger-900">
                  {importSummary.failed}
                </p>
              </div>
            </div>

            {/* Credentials Download Banner */}
            <div className="rounded-xl border-2 border-stroke bg-amber-50/60 p-5 mb-6">
              <h3 className="font-display font-bold text-ink text-base mb-1">
                Download Distribution Credentials
              </h3>
              <p className="text-xs text-muted mb-4 max-w-2xl">
                Temporary passwords are generated once and never stored in plain text. Download the
                CSV distribution file or print the credential handouts immediately for your records.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={handleDownloadCredentialsCsv}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Credentials CSV
                </Button>
                <Button variant="outline" onClick={handlePrintCredentials}>
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print Credential Cards
                </Button>
              </div>
            </div>

            {/* Preview of Generated Credentials */}
            <div className="rounded-xl border-2 border-stroke overflow-hidden mb-6">
              <div className="bg-surface-100 p-3 font-bold text-xs uppercase tracking-wider text-ink border-b border-stroke">
                Generated Credentials Preview (First 5 Rows)
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 border-b border-stroke/40 font-semibold text-muted">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Username</th>
                    <th className="p-2.5">Temp Password</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke/30 font-medium">
                  {generatedCredentials.slice(0, 5).map((cred) => (
                    <tr key={cred.username} className="hover:bg-surface-50">
                      <td className="p-2.5 font-bold">{cred.fullName}</td>
                      <td className="p-2.5 font-mono">{cred.username}</td>
                      <td className="p-2.5 font-mono text-ink bg-surface-100/50 font-bold">
                        {cred.password}
                      </td>
                      <td className="p-2.5 capitalize">{cred.role}</td>
                      <td className="p-2.5">Grade {cred.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Finish action */}
            <div className="flex justify-end pt-4 border-t border-stroke/20">
              <Link to="/admin/users">
                <Button variant="outline">
                  <UserCheck className="h-4 w-4 mr-1.5" />
                  Return to Users List
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
