import type { ClassReport } from "./api";

/* CSV export of a class report. One file, three labelled blocks (skills, assessments, roster),
   escaped for spreadsheets. Cells starting with = + - @ are prefixed with an apostrophe so a
   student's name can never be run as a formula. */

const cell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const line = (...cells: Array<string | number | null | undefined>) => cells.map(cell).join(",");

export function reportToCsv(title: string, period: string, report: ClassReport): string {
  const rows: string[] = [line(title), line("Period", period), ""];

  rows.push(line("Skill", "Score", "Change since previous period", "CEFR"));
  for (const skill of report.skills)
    rows.push(line(skill.skill, skill.score, skill.change, skill.cefr));
  rows.push("");

  rows.push(line("Assessment", "Type", "Date", "Submitted", "Average", "Highest", "Lowest"));
  for (const a of report.assessments) {
    rows.push(line(a.title, a.kind, a.date, a.submitted, a.avg, a.highest, a.lowest));
  }
  rows.push("");

  const supportIds = new Set(report.support.map((person) => person.id));
  rows.push(line("Student", "Progress", "Average", "Needs support"));
  for (const s of report.roster) {
    rows.push(line(s.name, s.progress, s.avg, supportIds.has(s.id) ? "yes" : "no"));
  }
  return rows.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM keeps Arabic names readable when the file is opened in Excel.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
