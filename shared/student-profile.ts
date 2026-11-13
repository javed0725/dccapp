export const STUDENT_PROFILE_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type StudentGrade = { grade: string; point: number | null };

export type StudentExamResult = {
  examName: string;
  date: string | Date | null;
  batchId: number;
  isModelTest: boolean;
  modelTestGroupId: string | null;
  obtainedMarks: number;
  totalMarks: number;
  subject?: string;
  mcqMarks?: number | null;
  cqMarks?: number | null;
  practicalMarks?: number | null;
  markingConfig?: {
    totalMarks?: number;
    mcqEnabled?: boolean;
    cqEnabled?: boolean;
    practicalEnabled?: boolean;
    mcqMax?: number;
    cqMax?: number;
    practicalMax?: number;
  } | null;
};

export function getStudentMonthIndex(value: string | null | undefined): number {
  if (!value) return -1;
  const cleaned = value.trim().toLowerCase();
  const numeric = Number(cleaned);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric - 1;
  return STUDENT_PROFILE_MONTHS.findIndex((month) =>
    month.toLowerCase().startsWith(cleaned.slice(0, 3))
  );
}

export function getStudentGrade(obtained: number, total: number): StudentGrade {
  if (obtained === -1) return { grade: "ABS", point: null };
  const percent = total > 0 ? (obtained / total) * 100 : 0;
  if (percent >= 80) return { grade: "A+", point: 5 };
  if (percent >= 70) return { grade: "A", point: 4 };
  if (percent >= 60) return { grade: "A-", point: 3.5 };
  if (percent >= 50) return { grade: "B", point: 3 };
  if (percent >= 40) return { grade: "C", point: 2 };
  if (percent >= 33) return { grade: "D", point: 1 };
  return { grade: "F", point: 0 };
}

export function calculateStudentGpa(
  results: Pick<StudentExamResult, "obtainedMarks" | "totalMarks">[],
): number | null {
  const points = results
    .map((result) => getStudentGrade(result.obtainedMarks, result.totalMarks).point)
    .filter((point): point is number => point !== null);
  return points.length ? points.reduce((sum, point) => sum + point, 0) / points.length : null;
}

export function groupStudentExamResults<T extends StudentExamResult>(
  results: T[],
): Array<{ key: string; results: T[] }> {
  const grouped = new Map<string, T[]>();
  results.forEach((result) => {
    const resultYear = result.date
      ? new Date(result.date).getFullYear()
      : "unknown";
    const examType = result.isModelTest
      ? result.modelTestGroupId
        ? `model-${result.modelTestGroupId}`
        : `model-${resultYear}`
      : `exam-${resultYear}`;
    const key = [
      result.examName,
      result.batchId,
      examType,
    ].join("::");
    grouped.set(key, [...(grouped.get(key) ?? []), result]);
  });
  return Array.from(grouped.entries())
    .map(([key, groupedResults]) => ({
      key,
      results: groupedResults.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      }),
    }))
    .sort((a, b) => {
      const dateA = a.results[0]?.date ? new Date(a.results[0].date).getTime() : 0;
      const dateB = b.results[0]?.date ? new Date(b.results[0].date).getTime() : 0;
      return dateB - dateA;
    });
}
