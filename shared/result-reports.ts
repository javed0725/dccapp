import type { ModelTestSubject } from "./schema.js";

export const BD_GRADING_SCALE = [
  { min: 80, range: "80–100", grade: "A+", gp: 5 },
  { min: 70, range: "70–79", grade: "A", gp: 4 },
  { min: 60, range: "60–69", grade: "A-", gp: 3.5 },
  { min: 50, range: "50–59", grade: "B", gp: 3 },
  { min: 40, range: "40–49", grade: "C", gp: 2 },
  { min: 33, range: "33–39", grade: "D", gp: 1 },
  { min: 0, range: "0–32", grade: "F", gp: 0 },
] as const;

export function getBangladeshGrade(obtained: number, total: number) {
  if (obtained === -1) return { grade: "ABS", gp: 0 };
  if (!Number.isFinite(obtained) || !Number.isFinite(total) || total <= 0 ||
      obtained < 0 || obtained > total) return { grade: "INC", gp: 0 };
  const entry = BD_GRADING_SCALE.find((item) => obtained / total * 100 >= item.min)!;
  return { grade: entry.grade as string, gp: entry.gp as number };
}

export type ReportStudent = {
  id: number;
  name: string;
  studentCustomId?: string | null;
  batchId: number;
  academicGroup?: string | null;
};

export type ReportResult = {
  id?: number;
  studentId: number;
  batchId?: number;
  subject: string;
  obtainedMarks: number;
  totalMarks: number;
  cqMarks?: number | null;
  mcqMarks?: number | null;
  practicalMarks?: number | null;
  date?: string | Date;
};

export function subjectAppliesToStudent(subject: ModelTestSubject, student: ReportStudent) {
  return subject.allGroups || !subject.academicGroup?.trim() ||
    subject.academicGroup.trim().toLocaleLowerCase() === student.academicGroup?.trim().toLocaleLowerCase();
}

export function summarizeModelTest(
  student: ReportStudent,
  subjects: ModelTestSubject[],
  results: ReportResult[],
) {
  const rows = subjects.filter((subject) => subjectAppliesToStudent(subject, student)).map((subject) => {
    // Prefer the newest saved record when legacy data contains duplicate entries.
    const candidates = results.filter((r) => r.studentId === student.id && r.subject === subject.name &&
      (r.batchId == null || r.batchId === student.batchId));
    candidates.sort((a, b) =>
      new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime() || (b.id ?? 0) - (a.id ?? 0));
    const result = candidates[0];
    const valid = !!result && result.totalMarks === subject.totalMarks &&
      getBangladeshGrade(result.obtainedMarks, subject.totalMarks).grade !== "INC";
    const grade = valid ? getBangladeshGrade(result.obtainedMarks, subject.totalMarks) : { grade: "INC", gp: 0 };
    return { subject, result, ...grade };
  });
  const incomplete = !rows.length || rows.some((row) => row.grade === "INC");
  const absent = rows.some((row) => row.grade === "ABS");
  const failed = rows.some((row) => row.grade === "F");
  const passed = !incomplete && !absent && !failed;
  const gpa = passed ? Math.round(rows.reduce((sum, r) => sum + r.gp, 0) / rows.length * 100) / 100 : 0;
  const grade = !passed ? (incomplete ? "INC" : absent ? "ABS" : "F") :
    BD_GRADING_SCALE.find((item) => gpa >= item.gp)!.grade;
  return {
    student, rows, gpa, grade, passed,
    status: incomplete ? "Incomplete" : absent ? "Absent" : failed ? "Failed" : "Passed",
    totalMarks: rows.reduce((sum, row) => sum + row.subject.totalMarks, 0),
    obtainedMarks: rows.reduce((sum, row) => sum +
      (row.result && row.grade !== "INC" && row.result.obtainedMarks >= 0 ? row.result.obtainedMarks : 0), 0),
  };
}

export type StudentReport = ReturnType<typeof summarizeModelTest>;

export function rankModelTestReports(reports: StudentReport[]) {
  const sorted = [...reports].sort((a, b) =>
    Number(b.passed) - Number(a.passed) || b.gpa - a.gpa || b.obtainedMarks - a.obtainedMarks ||
    String(a.student.studentCustomId ?? a.student.id).localeCompare(
      String(b.student.studentCustomId ?? b.student.id), "en", { numeric: true }) || a.student.id - b.student.id);
  let previous: StudentReport | undefined;
  let previousPosition = 0;
  return sorted.map((report, index) => {
    const tied = previous?.passed && report.passed && previous.gpa === report.gpa &&
      previous.obtainedMarks === report.obtainedMarks;
    const position = report.passed ? (tied ? previousPosition : index + 1) : null;
    previous = report;
    previousPosition = position ?? 0;
    return { ...report, position };
  });
}

export function ordinal(position: number) {
  const mod = position % 100;
  const suffix = mod >= 11 && mod <= 13 ? "th" :
    ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] ?? "th";
  return `${position}${suffix}`;
}
