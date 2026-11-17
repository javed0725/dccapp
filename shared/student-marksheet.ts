import { getSubjectMarkingRule, type MarkComponent } from "./marking.js";
import { getStudentGrade } from "./student-profile.js";

export type StudentMarksheetResult = {
  subject: string;
  obtainedMarks: number | null;
  totalMarks: number;
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

type SubjectComponent = Exclude<MarkComponent, "total">;
type ConfiguredComponent = { key: SubjectComponent; label: string; max: number };

export type StudentMarksheetRow = {
  result: StudentMarksheetResult;
  grade: string;
  point: number | null;
  isAbsent: boolean;
  isPending: boolean;
  components: Partial<Record<Exclude<MarkComponent, "total">, number | null>>;
  passed: boolean;
};

const COMPONENT_ORDER = ["cq", "mcq", "practical"] as const;

export function getStudentMarksheetData(results: StudentMarksheetResult[]) {
  const rows: StudentMarksheetRow[] = results.map((result) => {
    const isPending = result.obtainedMarks === null;
    const { grade, point } = result.obtainedMarks === null
      ? { grade: "—", point: null }
      : getStudentGrade(result.obtainedMarks, result.totalMarks);
    const isAbsent = result.obtainedMarks === -1;
    const rule = getSubjectMarkingRule(result.subject, result.markingConfig ?? undefined);
    const configuredComponents = rule.fields.filter((field) => field.key !== "total") as ConfiguredComponent[];
    const components: StudentMarksheetRow["components"] = {
      cq: result.cqMarks,
      mcq: result.mcqMarks,
      practical: result.practicalMarks,
    };
    const hasComponentMarks = configuredComponents.some((field) => components[field.key] != null);
    const componentPass = !hasComponentMarks || configuredComponents.every((field) => {
      const value = components[field.key];
      return value != null && value >= Math.ceil(field.max * 0.33);
    });

    return {
      result,
      grade,
      point,
      isAbsent,
      isPending,
      components,
      passed: !isAbsent && !isPending && grade !== "F" && componentPass,
    };
  });
  const componentColumns = COMPONENT_ORDER.filter((component) =>
    rows.some(({ result, components }) => {
      const configured = getSubjectMarkingRule(result.subject, result.markingConfig ?? undefined)
        .fields.some((field) => field.key === component);
      return configured || components[component] != null;
    })
  );
  const presentRows = rows.filter((row) => !row.isAbsent);
  const totalObtained = presentRows.reduce((sum, row) => sum + (row.result.obtainedMarks ?? 0), 0);
  const totalFull = presentRows.reduce((sum, row) => sum + row.result.totalMarks, 0);
  const gradedRows = rows.filter((row) => row.point !== null);
  const gpa = gradedRows.length
    ? gradedRows.reduce((sum, row) => sum + (row.point ?? 0), 0) / gradedRows.length
    : null;

  return {
    rows,
    componentColumns,
    totalObtained,
    totalFull,
    gpa,
    passed: rows.length > 0 && rows.every((row) => row.passed),
    pending: rows.some((row) => row.isPending),
  };
}
