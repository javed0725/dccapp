import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderPdfDocument } from "./attendance-pdf.js";
import { BD_GRADING_SCALE, ordinal, type StudentReport } from "../shared/result-reports.js";
import type { ModelTestSubject } from "../shared/schema.js";

export type ReportMetadata = { examName: string; className: string; session: string; group: string };
type Cell = { text: string; [key: string]: unknown };
const cell = (text: unknown, extra: Record<string, unknown> = {}): Cell => ({
  text: String(text ?? "—").normalize("NFC"), alignment: "center", ...extra,
});
const heading = (text: string, extra: Record<string, unknown> = {}) =>
  cell(text, { bold: true, fillColor: "#edf0f3", ...extra });
const mark = (row: StudentReport["rows"][number] | undefined, key: "cqMarks" | "mcqMarks" | "practicalMarks") =>
  row?.result && !["ABS", "INC"].includes(row.grade) ? row.result[key] ?? "—" : "—";

let logoPromise: Promise<string> | undefined;
function logoData() {
  logoPromise ??= readFile(path.resolve(process.cwd(), "attached_assets/IMG_20260126_081644_1769393818079.jpg"))
    .then((data) => `data:image/jpeg;base64,${data.toString("base64")}`)
    .catch((error) => { logoPromise = undefined; throw error; });
  return logoPromise;
}

function base(meta: ReportMetadata, title: string): Record<string, unknown> {
  return {
    info: { title: `${meta.examName} — ${title}`, author: "Dynamic Coaching Center" },
    language: "bn-BD", pageSize: "A4", pageMargins: [30, 30, 30, 42],
    defaultStyle: { font: "Noto Sans Bengali", fontSize: 9, color: "#111111" },
    footer: (current: number, total: number) => ({
      text: `Dynamic Coaching Center  |  ${meta.examName}  |  Page ${current} of ${total}`,
      alignment: "center", fontSize: 7, margin: [25, 10, 25, 0],
    }),
  };
}

const tableLayout = {
  hLineWidth: () => 0.5, vLineWidth: () => 0.5,
  hLineColor: () => "#777777", vLineColor: () => "#777777",
  paddingTop: () => 5, paddingBottom: () => 5,
  paddingLeft: () => 4, paddingRight: () => 4,
};

export async function renderTranscriptPdf(report: StudentReport, meta: ReportMetadata) {
  const logo = await logoData();
  const gradeScale = {
    width: 157, fontSize: 7,
    table: { widths: [54, 34, 38], body: [
      [heading("Marks (%)"), heading("Grade"), heading("Point")],
      ...BD_GRADING_SCALE.map((g) => [cell(g.range), cell(g.grade), cell(g.gp.toFixed(2))]),
    ] },
    layout: { ...tableLayout, paddingTop: () => 2, paddingBottom: () => 2 },
  };
  return renderPdfDocument({
    ...base(meta, "Academic Transcript"),
    background: (_page: number, size: { width: number; height: number }) => ({
      image: logo, width: 250, opacity: 0.065,
      absolutePosition: { x: (size.width - 250) / 2, y: (size.height - 250) / 2 },
    }),
    content: [
      { text: "Dynamic Coaching Center", bold: true, fontSize: 21, alignment: "center", margin: [0, 0, 0, 4] },
      { text: "ACADEMIC TRANSCRIPT", bold: true, fontSize: 14, alignment: "center", margin: [0, 0, 0, 5] },
      { text: meta.examName, fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 14] },
      { columns: [
        { width: "*", stack: [
          { text: `Session: ${meta.session}`, margin: [0, 3, 0, 12] },
          { text: `Student Name: ${report.student.name}`, bold: true, margin: [0, 0, 6, 8] },
          { text: `Roll: ${report.student.studentCustomId || "—"}`, margin: [0, 0, 0, 8] },
          { text: `Class: ${meta.className}`, margin: [0, 0, 0, 8] },
          { text: `Group: ${report.student.academicGroup || "General"}` },
        ] },
        gradeScale,
      ], columnGap: 12, margin: [0, 0, 0, 18] },
      { table: { headerRows: 1, widths: [21, "*", 35, 35, 42, 54, 40, 40], body: [
        ["Sl. No.", "Subject Name", "CQ", "MCQ", "Practical", "Total Marks", "Letter Grade", "Grade Point"].map((v) => heading(v)),
        ...report.rows.map((row, index) => [
          cell(index + 1), cell(row.subject.name, { alignment: "left" }),
          cell(mark(row, "cqMarks")), cell(mark(row, "mcqMarks")), cell(mark(row, "practicalMarks")),
          cell(`${row.grade === "ABS" ? "ABS" : row.grade === "INC" ? "—" : row.result!.obtainedMarks} / ${row.subject.totalMarks}`),
          cell(row.grade), cell(row.gp.toFixed(2)),
        ]),
      ] }, layout: tableLayout },
      { table: { widths: ["*", "*", "*"], body: [[
        cell(`Total: ${report.obtainedMarks} / ${report.totalMarks}`, { bold: true }),
        cell(`Overall GPA: ${report.gpa.toFixed(2)} / 5.00`, { bold: true }),
        cell(`Grade: ${report.grade}\n${report.status}`, { bold: true }),
      ]] }, layout: tableLayout, margin: [0, 12, 0, 8] },
      { text: "Grades are based on percentage marks. All listed subjects are compulsory and equally weighted for GPA. Failure or absence in any required subject makes overall GPA 0.00. Missing marks are shown as — and the result is Incomplete. No optional-subject adjustment is applied.", fontSize: 7, color: "#555555", margin: [0, 0, 0, 26] },
      { columns: [
        { text: "________________________\nClass Teacher", alignment: "center" },
        { text: "________________________\nExamination Controller", alignment: "center" },
        { text: "________________________\nAuthority", alignment: "center" },
      ], fontSize: 8 },
    ],
  });
}

export async function renderTabulationPdf(
  reports: (StudentReport & { position: number | null })[],
  subjects: ModelTestSubject[],
  meta: ReportMetadata,
) {
  // Split wide grids into subject bands; every band repeats identifiers and summary.
  // This keeps all component columns legible rather than shrinking a full curriculum to tiny text.
  const bands: ModelTestSubject[][] = [];
  for (let start = 0; start < subjects.length; start += 4) bands.push(subjects.slice(start, start + 4));
  const content = bands.flatMap((band, bandIndex) => {
    const subjectHeaders = band.flatMap((subject) => [
      heading(`${subject.name}\nMax: ${subject.totalMarks}`, { colSpan: 4 }), cell(""), cell(""), cell(""),
    ]);
    const columnHeaders = band.flatMap(() => ["CQ", "MCQ", "Prac.", "Total"].map((v) => heading(v)));
    const summaryHeaders = ["Total Marks", "GPA", "Grade", "Position"].map((v) => heading(v, { rowSpan: 2 }));
    const top = [heading("Roll", { rowSpan: 2 }), heading("Student Name", { rowSpan: 2 }),
      heading("Group", { rowSpan: 2 }), ...subjectHeaders, ...summaryHeaders];
    const bottom = [cell(""), cell(""), cell(""), ...columnHeaders, cell(""), cell(""), cell(""), cell("")];
    const rows = reports.map((report) => [
      cell(report.student.studentCustomId || "—"), cell(report.student.name, { alignment: "left" }),
      cell(report.student.academicGroup || "General"),
      ...band.flatMap((subject) => {
        const row = report.rows.find((r) => r.subject.name === subject.name);
        return [
          cell(mark(row, "cqMarks")), cell(mark(row, "mcqMarks")), cell(mark(row, "practicalMarks")),
          cell(!row ? "N/A" : row.grade === "INC" ? "—" : row.grade === "ABS" ? "ABS" : row.result!.obtainedMarks),
        ];
      }),
      cell(`${report.obtainedMarks}/${report.totalMarks}`), cell(report.gpa.toFixed(2)),
      cell(report.grade), cell(report.position ? ordinal(report.position) : "—"),
    ]);
    return [
      { text: "Dynamic Coaching Center", fontSize: 17, bold: true, alignment: "center",
        ...(bandIndex ? { pageBreak: "before" } : {}) },
      { text: `${meta.examName} — Class Tabulation / Merit List`, fontSize: 11, bold: true, alignment: "center", margin: [0, 2, 0, 4] },
      { text: `Class: ${meta.className}   |   Group: ${meta.group}   |   Session: ${meta.session}   |   Students: ${reports.length}   |   Subject band ${bandIndex + 1}/${bands.length}`,
        fontSize: 8, alignment: "center", margin: [0, 0, 0, 9] },
      { fontSize: 6.5, table: { headerRows: 2, dontBreakRows: true,
        widths: [37, 83, 42, ...band.flatMap(() => [20, 20, 20, 25]), 45, 26, 26, 32],
        body: [top, bottom, ...rows],
      }, layout: { ...tableLayout, paddingLeft: () => 2, paddingRight: () => 2 } },
      { text: "Merit order: passed students first, GPA descending, then total marks. Equal GPA and total share a position (1st, 1st, 3rd). Failed, absent and incomplete results are not ranked. N/A = subject does not apply; — = missing/not recorded; ABS = absent. All required subjects equally weighted; no optional-subject adjustment.",
        fontSize: 7, margin: [0, 9, 0, 0] },
    ];
  });
  return renderPdfDocument({ ...base(meta, "Class Result Sheet"), pageOrientation: "landscape", content });
}
